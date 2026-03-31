/**
 * AgentService manages the interaction with OpenRouter AI.
 * Includes advanced fallback logic for provider errors.
 */
export class AgentService {
  constructor(apiKey, appHandlers) {
    this.apiKey = apiKey;
    this.appHandlers = appHandlers;
    
    // Primary: OpenRouter Free Models Router (auto-selects available free endpoint)
    this.modelName = "openrouter/free"; 
    
    this.messages = [
      { 
        role: "system", 
        content: "You are the KBZPay Academic Assistant. Help students find courses/centers in Myanmar. When a user asks about courses or suggestions, you MUST use the 'search_education' tool and NEVER make up results or go outside. Be concise and professional." 
      }
    ];
  }

  isCourseRelated(text) {
    if (!text) return false;
    return /course|courses|class|classes|learn|study|training|ielts|ged|lcci|english|japanese|korean|language/i.test(text);
  }

  async sendMessage(userInput) {
    try {
      this.messages.push({ role: "user", content: userInput });

      // Let the model decide, but require tool usage for course-related queries.
      const toolChoice = this.isCourseRelated(userInput) ? "required" : "auto";
      const response = await this.callOpenRouter(toolChoice);
      
      if (!response.choices || response.choices.length === 0) {
        throw new Error("Empty response from provider");
      }

      const message = response.choices[0].message;

      if (message.tool_calls && message.tool_calls.length > 0) {
        return await this.handleToolCalls(message.tool_calls);
      }

      this.messages.push(message);
      return { role: 'assistant', content: message.content || "How else can I help?" };
    } catch (error) {
      console.error(`Agent Error (${this.modelName}):`, error);
      
      return { role: 'assistant', content: "The AI service is currently overwhelmed. Please wait 5 seconds and try again." };
    }
  }

  async callOpenRouter(toolChoice = "auto") {
    const tools = [
      {
        type: "function",
        function: {
          name: "search_education",
          description: "Fetch courses. Query '' for all.",
          parameters: {
            type: "object",
            properties: { query: { type: "string" } },
            required: ["query"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "navigate_to_page",
          description: "Change screen to 'history'.",
          parameters: {
            type: "object",
            properties: { page: { type: "string", enum: ["home", "history"] } },
            required: ["page"]
          }
        }
      }
    ];

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": window.location.origin,
        "X-Title": "KBZPay Education Assistant"
      },
      body: JSON.stringify({
        model: this.modelName,
        messages: this.messages,
        tools: tools,
        tool_choice: toolChoice
      })
    });

    const data = await response.json();
    if (!response.ok) {
      // Catch "Provider returned error" specifically
      throw new Error(data.error?.message || "Provider Error");
    }
    return data;
  }

  async handleToolCalls(toolCalls) {
    this.messages.push({ role: "assistant", tool_calls: toolCalls });
    let lastToolData = null;
    let lastToolType = null;

    for (const toolCall of toolCalls) {
      const name = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments);
      let result;
      try {
        if (name === "search_education") {
          result = await this.appHandlers.searchEducation(args.query);
          lastToolData = result;
          lastToolType = "courses";
        } else if (name === "navigate_to_page") {
          result = this.appHandlers.navigateTo(args.page);
        }
      } catch (e) { result = { error: "Tool fail" }; }

      this.messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        name: name,
        content: JSON.stringify(result)
      });
    }

    const finalResponse = await this.callOpenRouter();
    const finalMessage = finalResponse.choices[0].message;
    this.messages.push(finalMessage);
    
    return { 
      role: 'assistant', 
      content: finalMessage.content,
      uiData: lastToolData && lastToolData.length > 0 ? { type: lastToolType, items: lastToolData } : null
    };
  }
}
