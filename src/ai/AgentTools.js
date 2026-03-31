/**
 * Definition of tools the AI Agent can invoke.
 * These match the function calling schema for Google Gemini.
 */

export const TOOL_DEFINITIONS = [
  {
    name: "search_education",
    description: "Search for educational centers or courses by keyword (e.g., 'IELTS', 'GED', 'KMD').",
    parameters: {
      type: "OBJECT",
      properties: {
        query: {
          type: "STRING",
          description: "The search term or category to find.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_center_details",
    description: "Get detailed information about a specific educational center, including its courses and location.",
    parameters: {
      type: "OBJECT",
      properties: {
        center_id: {
          type: "STRING",
          description: "The unique ID of the educational center.",
        },
      },
      required: ["center_id"],
    },
  },
  {
    name: "navigate_to_page",
    description: "Navigate the user to a specific page in the application.",
    parameters: {
      type: "OBJECT",
      properties: {
        page: {
          type: "STRING",
          enum: ["home", "history", "courses", "schools", "about", "contact"],
          description: "The page to navigate to.",
        },
      },
      required: ["page"],
    },
  },
];
