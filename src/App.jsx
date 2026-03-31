import React, { useState, useEffect, useMemo } from 'react';
import './App.css'; 
import { Search, MapPin, Star, Menu as MenuIcon, Bell as BellIcon, BookOpenText, Award, GraduationCap, Globe2, MessageCircle, X, ChevronLeft, ArrowLeft, Send, User, Phone, FileText, CheckCircle, Home, LayoutList, History, Info, ChevronRight } from 'lucide-react';
import { AgentService } from './ai/AgentService';

const getApiUrl = (path) => {
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return path; 
  }
  return `https://uat-miniapp.kbzpay.com${path}`; 
};

export default function App() {
  const [currentPage, setCurrentPage] = useState('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [userProfile, setUserProfile] = useState(null);
  const [enrollmentResult, setEnrollmentResult] = useState(null);
  const [enrollmentRequestData, setEnrollmentRequestData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [centers, setCenters] = useState([]);
  const [courses, setCourses] = useState([]);
  const [selectedCenter, setSelectedCenter] = useState(null); 
  const [authToken, setAuthToken] = useState("");
  const [historyList, setHistoryList] = useState([]);

  // AI Agent Instance
  const agent = useMemo(() => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) return null;

    return new AgentService(apiKey, {
      searchEducation: async (query) => {
        const searchApiUrl = getApiUrl("/service/ABH008_KST__Education/1.0.1/search"); 
        try {
          const normalizeQuery = (q) => {
            const text = (q || "").toLowerCase();
            const known = ["korean", "japanese", "english", "ielts", "ged", "lcci"];
            for (const k of known) {
              if (text.includes(k)) return k;
            }
            const aboutMatch = text.match(/about\s+([a-z0-9]+)/i);
            if (aboutMatch) return aboutMatch[1];
            return q || "";
          };

          const trySearch = async (q) => {
            const response = await fetch(searchApiUrl, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json', 'client_id': import.meta.env.VITE_CLIENT_ID },
            body: JSON.stringify({ q: q || "" })
            });
            const data = await response.json();
            const results = data.result?.results || [];
            return results.filter(r => r.type === 'course').map(c => ({
            id: c.course_id,
            title: c.title,
            price: Array.isArray(c.price) ? c.price[0] : (c.price || 0),
            schedule: c.schedule,
            instructor_name: c.instructor_name,
            period: c.period
            }));
          };

          const cleanQuery = normalizeQuery(query);
          let results = await trySearch(cleanQuery);
          if ((!results || results.length === 0) && cleanQuery && cleanQuery !== "") {
            results = await trySearch("");
          }
          return results;
        } catch (e) { return []; }
      },
      getCenterInfo: async (id) => {
        const detailApiUrl = getApiUrl("/service/ABH008_KST__Education/1.0.1/centers"); 
        try {
          const response = await fetch(detailApiUrl, {
            method: 'POST', 
            headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json', 'client_id': import.meta.env.VITE_CLIENT_ID },
            body: JSON.stringify({ center_id: id }) 
          });
          return await response.json();
        } catch (e) { return { error: "Failed to fetch details" }; }
      },
      navigateTo: (page) => {
        setCurrentPage(page);
        return { success: true, message: `Navigated to ${page}` };
      }
    });
  }, [authToken]);

  useEffect(() => {
    const handleTrigger = (e) => {
      const course = e.detail;
      if (course) handleEnrollmentRequest(course);
    };
    window.addEventListener('enroll-trigger', handleTrigger);
    return () => window.removeEventListener('enroll-trigger', handleTrigger);
  }, [authToken, selectedCenter]);

  useEffect(() => {
    const getEducationData = async () => {
      const authUrl = getApiUrl("/baas/auth/v1.0/oauth2/token");
      const clientId = import.meta.env.VITE_CLIENT_ID;
      const clientSecret = import.meta.env.VITE_CLIENT_SECRET;
      try {
        const tokenParams = new URLSearchParams();
        tokenParams.append("client_id", clientId);
        tokenParams.append("client_secret", clientSecret);
        tokenParams.append("grant_type", 'client_credentials');

        const authResponse = await fetch(authUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: tokenParams
        });

        if (!authResponse.ok) throw new Error("Token Failed");
        const authData = await authResponse.json();
        const token = authData.access_token;
        setAuthToken(token);

        handleAutoLogin(token);
 
        const centersApiUrl = getApiUrl("/service/ABH008_KST__Education/1.0.1/centers/all");
        const centersResponse = await fetch(centersApiUrl, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!centersResponse.ok) throw new Error("Data Fetching Failed");
        const centersData = await centersResponse.json();
        if(centersData && centersData.centers) {
            setCenters(centersData.centers);
        }
      } catch (error) {
          console.error("API Error:", error);
      } finally {
          setLoading(false);
      }
    };
    getEducationData();
  }, []);

  useEffect(() => {
    if (currentPage === 'history') fetchHistoryData();
    else if (currentPage === 'courses') handleSearch(searchQuery || "");
    else if (currentPage === 'home') { setSearchQuery(''); if (authToken) fetchAllCenters(); }
  }, [currentPage, authToken]);

  const fetchAllCenters = async () => {
    const centersApiUrl = getApiUrl("/service/ABH008_KST__Education/1.0.1/centers/all");
    try {
      const response = await fetch(centersApiUrl, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (response.ok) {
        const data = await response.json();
        if (data && data.centers) setCenters(data.centers); 
      }
    } catch (error) {}
  };

  const fetchHistoryData = async () => {
    setLoading(true);
    const historyName = "Kyaw Kyaw";
    const historyUrl = getApiUrl(`/service/ABH008_KST__Education/1.0.1/enrollments/history?name=${encodeURIComponent(historyName)}`); 
    try {
      const response = await fetch(historyUrl, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${authToken}`, 'client_id': import.meta.env.VITE_CLIENT_ID }
      });
      if (!response.ok) throw new Error("History API Failed");
      const data = await response.json();
      setHistoryList(data.history || []);
    } catch (error) {} finally { setLoading(false); }
  };

 const handleCenterClick = async (centerId) => {
    setLoading(true);
    const detailApiUrl = getApiUrl("/service/ABH008_KST__Education/1.0.1/centers"); 
    try {
      const response = await fetch(detailApiUrl, {
        method: 'POST', 
        headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json', 'client_id': import.meta.env.VITE_CLIENT_ID },
        body: JSON.stringify({ center_id: centerId }) 
      });
      if (!response.ok) throw new Error("Detail API failed");
      const data = await response.json();
      const oldData = centers.find(c => c.id === centerId) || {};
      const safeMergedData = { ...oldData, ...data }; 
      setSelectedCenter(safeMergedData); 
      setCurrentPage('detail'); 
    } catch (error) {} finally { setLoading(false); }
  };

  const handleSearch = async (keyword) => {
    setLoading(true);
    const searchApiUrl = getApiUrl("/service/ABH008_KST__Education/1.0.1/search"); 
    try {
      const response = await fetch(searchApiUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json', 'client_id': import.meta.env.VITE_CLIENT_ID },
        body: JSON.stringify({ q: keyword || "" })
      });
      if (!response.ok) throw new Error("Search API error");
      const data = await response.json();
      const actualResults = data.result?.results || [];
      const newCenters = []; const newCourses = [];
      actualResults.forEach(item => {
        if (item.type === 'center') newCenters.push({ id: item.id, name: item.name, location: item.location || 'Yangon', rating: item.rating ? item.rating[0] : 0, tabs: item.tabs || [] });
        else if (item.type === 'course') newCourses.push({ id: item.course_id, title: item.title, schedule: item.schedule, period: item.period, instructor_name: item.instructor_name, price: Array.isArray(item.price) ? item.price[0] : (item.price || 0), service_year: item.service_year });
      });
      setCenters(newCenters); setCourses(newCourses);
      if (newCourses.length > 0 && currentPage !== 'courses') setCurrentPage('courses');
      return data;
    } catch (error) { return null; } finally { setLoading(false); }
  };

  const handleCategoryClick = (catName) => { setSearchQuery(catName); setCurrentPage('courses'); };

  const handleEnrollmentRequest = async (course) => {
    setLoading(true);
    const requestUrl = getApiUrl("/service/ABH008_KST__Education/1.0.1/enrollment/request");
    try {
      let partnerName = "Verified Partner";
      let centerId = selectedCenter?.center_id ?? selectedCenter?.id;

      if (!centerId) {
        const title = (course.title || "").toUpperCase();
        if (title.includes("JAPANESE") || title.includes("ENGLISH") || title.includes("KOREAN")) {
          centerId = "CENTER_002"; partnerName = "Language Center";
        } else if (title.includes("GED") || title.includes("LCCI") || title.includes("COMPUTER")) {
          centerId = "CENTER_003"; partnerName = "KMD Center";
        } else {
          centerId = "CENTER_001"; partnerName = "Strategy First University";
        }
      } else { partnerName = selectedCenter.name; }

      const courseId = course?.id ?? course?.course_id ?? "";
      if (!courseId) return;

      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json', 'client_id': import.meta.env.VITE_CLIENT_ID },
        body: JSON.stringify({ center_id: centerId, course_id: courseId, fullname: "Kyaw Kyaw" })
      });
      const data = await response.json();
      if (data.resCode === "0") { 
        const responsePrice = data?.result?.summary?.price;
        const coursePrice = Array.isArray(course?.price) ? course.price[0] : course?.price;
        const safePrice = responsePrice ?? coursePrice ?? 0;
        const resultWithPrice = { ...data.result, summary: { ...data.result.summary, price: safePrice, partnerName: partnerName } };
        setEnrollmentRequestData(resultWithPrice); 
        setCurrentPage('confirm'); 
      }
    } catch (error) {} finally { setLoading(false); }
  };

  const handleConfirmEnrollment = async () => {
    setLoading(true);
    const appCubeOrderApiUrl = getApiUrl("/service/ABH008_KST__Education/1.0.0/payment"); 
    const summary = enrollmentRequestData?.result?.summary || enrollmentRequestData?.summary || {};
    const actualPrice = summary.price || 1000;

    try {
      const response = await fetch(appCubeOrderApiUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json', 'client_id': import.meta.env.VITE_CLIENT_ID },
        body: JSON.stringify({ amount: Number(actualPrice), orderId: "ORD_" + Date.now() })
      });
      const rawData = await response.json(); 
      const orderData = rawData.result || rawData;

      if (window.ma && window.ma.callNativeAPI) {
        window.ma.callNativeAPI("startPay", { prepayId: orderData.preOrderId, orderInfo: orderData.orderInfo.orderInfo, sign: orderData.orderInfo.sign, signType: orderData.orderInfo.signType || "SHA256", useMiniResultFlag: true, }, (res) => {
          if (res.resultCode == 1 || res.resultCode == "1") {
            const successApiUrl = getApiUrl("/service/ABH008_KST__Education/1.0.1/payment/success");
            const enrollId = enrollmentRequestData?.result?.id || enrollmentRequestData?.id || summary?.id;
            fetch(successApiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}`, 'client_id': import.meta.env.VITE_CLIENT_ID }, body: JSON.stringify({ transaction_id: orderData.preOrderId, enrollment_id: enrollId }) });
            setEnrollmentResult({ ...orderData, course_name: summary.course_name }); setCurrentPage('success'); 
          }
        });
      } else { setEnrollmentResult({ ...orderData, course_name: summary.course_name }); setCurrentPage('success'); }
    } catch (error) {} finally { setLoading(false); }
  };

  const handleAutoLogin = (currentAuthToken) => {
    if (window.ma && window.ma.getAuthCode) {
      window.ma.getAuthCode({
        scopes: ['USER_NICKNAME', 'PLAINTEXT_MOBILE_PHONE'], 
        success: async (res) => {
          try {
            const response = await fetch(getApiUrl("/service/ABH008_KST__Education/1.0.1/AutoLogin"), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentAuthToken}`, 'client_id': import.meta.env.VITE_CLIENT_ID },
              body: JSON.stringify({ authCode: res.authCode })
            });
            const data = await response.json();
            let extData = data?.result?.[0]?.result?.userInfo || data?.result?.[0]?.result || data?.userInfo || data?.result || data;
            if (extData) setUserProfile({ name: extData.USER_NICKNAME || extData.name || "miniapp_user", phone: extData.PLAINTEXT_MOBILE_PHONE || extData.phone || "" });
          } catch (error) {}
        }
      });
    } else setUserProfile({ name: "Testing User", phone: "0912345678" });
  };

  return (
    <div className="browser-center-wrapper">
      <div className="phone-container">
        {!['success', 'menu', 'confirm', 'registration', 'chat'].includes(currentPage) && (
          <header className="header"><div className="header-top">{currentPage === 'home' ? (<MenuIcon className="clickable" onClick={() => setCurrentPage('menu')} color="white" size={26} strokeWidth={2.5} />) : (<span className="clickable" onClick={() => { if (currentPage === 'courses' && searchQuery !== '') { setCurrentPage('home'); setSearchQuery(''); } else if (['courses', 'schools', 'history', 'about', 'contact', 'terms'].includes(currentPage)) setCurrentPage('menu'); else setCurrentPage('home'); }} style={{ fontSize: '24px', color: 'white' }}>←</span>)}<h1 className="header-title">KBZPAY EDUCATION</h1><BellIcon color="white" size={24} strokeWidth={2.5} /></div></header>
        )}
        <div className="scroll-container" style={{ backgroundColor: ['confirm', 'registration', 'success', 'menu'].includes(currentPage) ? '#0054A6' : '#F8F9FC' }}>
          {loading && currentPage !== 'home' ? (<div style={{ padding: '60px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}><div className="spinner"></div></div>) : (
             <>
                {currentPage === 'home' && (<HomeView centers={centers} onCardClick={handleCenterClick} onSearch={handleSearch} onCategoryClick={handleCategoryClick} searchQuery={searchQuery} setSearchQuery={setSearchQuery} />)}
                {currentPage === 'detail' && (<DetailView center={selectedCenter} onBack={() => setCurrentPage('home')} onEnrollClick={handleEnrollmentRequest} />)}
                {currentPage === 'confirm' && (<ConfirmEnrollView data={enrollmentRequestData} selectedCenter={selectedCenter} onRegister={() => setCurrentPage('registration')} onBack={() => setCurrentPage('detail')} />)}
                {currentPage === 'registration' && (<RegistrationFormView userProfile={userProfile} enrollmentData={enrollmentRequestData} onConfirm={handleConfirmEnrollment} onBack={() => setCurrentPage('confirm')} />)}
                {currentPage === 'success' && (<PaymentSuccessView result={enrollmentResult} selectedCenter={selectedCenter} onDone={() => {setCurrentPage('home');setEnrollmentResult(null);}} />)}
                {currentPage === 'menu' && (<MenuView onBack={() => setCurrentPage('home')} onCourseClick={() => setCurrentPage('courses')} onSchoolClick={() => setCurrentPage('schools')} onHistoryClick={() => setCurrentPage('history')} onAboutClick={() => setCurrentPage('about')} onContactClick={() => setCurrentPage('contact')} />)}
                {currentPage === 'courses' && (<CourseListView courses={courses} onEnrollClick={handleEnrollmentRequest} searchQuery={searchQuery} setSearchQuery={setSearchQuery} onSearch={handleSearch} />)}
                {currentPage === 'schools' && (<SchoolListView centers={centers} onCardClick={handleCenterClick} searchQuery={searchQuery} setSearchQuery={setSearchQuery} onSearch={handleSearch}  />)}
                {currentPage === 'history' && <HistoryView histories={historyList} />}
                {currentPage === 'about' && <AboutUsView />}
                {currentPage === 'contact' && <ContactUsView />}
                {currentPage === 'chat' && <ChatView onBack={() => setCurrentPage('home')} agent={agent} />}
             </>
          )}
        </div>
        {currentPage === 'home' && (<div className="clickable" onClick={() => setCurrentPage('chat')} style={{ position: 'absolute', bottom: '30px', right: '20px', zIndex: 1000, width: '64px', height: '64px', backgroundColor: '#0054A6', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', boxShadow: '0 8px 25px rgba(0, 84, 166, 0.4)', transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}><MessageCircle size={32} /></div>)}
      </div>
    </div>
  );
}

const ChatView = ({ onBack, agent }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([{ role: 'assistant', content: "Hello! I'm your KBZPay Academic Assistant. How can I help you with your educational journey today?" }]);
  const [isThinking, setIsThinking] = useState(false);
  const formatContent = (text) => { if (!text) return ""; const parts = text.split(/(\*\*.*?\*\*)/g); return parts.map((part, index) => { if (part.startsWith('**') && part.endsWith('**')) return <strong key={index} style={{ fontWeight: '900' }}>{part.slice(2, -2)}</strong>; return part; }); };
  const handleSend = async (text) => { const messageText = text || input; if (!messageText.trim() || !agent) return; if (!text) { setMessages(prev => [...prev, { role: 'user', content: messageText }]); setInput(''); } setIsThinking(true); const aiResponse = await agent.sendMessage(messageText); setMessages(prev => [...prev, aiResponse]); setIsThinking(false); };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#fff', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2000 }}>
      <div style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '15px', borderBottom: '1px solid #f0f0f0', backgroundColor: '#fff', position: 'sticky', top: 0, zIndex: 10 }}><button onClick={onBack} style={{ background: '#f5f5f7', border: 'none', borderRadius: '12px', padding: '8px', cursor: 'pointer', display: 'flex' }}><ArrowLeft size={20} color="#1d1d1f" /></button><div><div style={{ fontWeight: '900', fontSize: '18px', color: '#1d1d1f' }}>Academic Assistant</div><div style={{ fontSize: '12px', color: isThinking ? '#0054A6' : '#06C270', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '6px', height: '6px', backgroundColor: isThinking ? '#0054A6' : '#06C270', borderRadius: '50%' }}></div>{isThinking ? 'Agent is acting...' : 'Online'}</div></div></div>
      <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '100px' }}>
        {messages.map((msg, i) => (<div key={i} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '90%' }}><div style={{ padding: '16px 20px', borderRadius: '24px', borderBottomRightRadius: msg.role === 'user' ? '4px' : '24px', borderBottomLeftRadius: msg.role === 'assistant' ? '4px' : '24px', backgroundColor: msg.role === 'user' ? '#0054A6' : '#F2F2F7', color: msg.role === 'user' ? '#fff' : '#111', fontSize: '14px', lineHeight: '1.6', fontWeight: '600', boxShadow: msg.role === 'user' ? '0 4px 15px rgba(0, 84, 166, 0.15)' : 'none', whiteSpace: 'pre-wrap' }}>{formatContent(msg.content)}</div>{msg.uiData?.type === 'courses' && (<div style={{ marginTop: '15px', display: 'flex', flexDirection: 'column', gap: '12px' }}>{msg.uiData.items.map((course, idx) => (<div key={idx} style={{ backgroundColor: 'white', padding: '15px', borderRadius: '20px', border: '1px solid #eee', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}><div style={{ fontWeight: '800', fontSize: '15px', color: '#111', marginBottom: '6px' }}>{course.title}</div><div style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>{course.schedule} • {course.period || '3 Months'}</div><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div style={{ fontWeight: '800', fontSize: '14px', color: '#0054A6' }}>{Number(course.price).toLocaleString()} MMK</div><button onClick={() => window.dispatchEvent(new CustomEvent('enroll-trigger', { detail: course }))} style={{ backgroundColor: '#0054A6', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Enroll</button></div></div>))}</div>)}</div>))}
        {isThinking && (<div style={{ alignSelf: 'flex-start', padding: '12px 18px', backgroundColor: '#F2F2F7', borderRadius: '24px', borderBottomLeftRadius: '4px' }}><div className="spinner" style={{ width: '20px', height: '20px', border: '3px solid #ccc', borderTopColor: '#0054A6' }}></div></div>)}
      </div>
      <div style={{ padding: '20px', backgroundColor: '#fff', position: 'fixed', bottom: 0, left: 0, right: 0, borderTop: '1px solid #f0f0f0' }}><div style={{ display: 'flex', gap: '12px', alignItems: 'center', backgroundColor: '#f5f5f7', padding: '10px 10px 10px 20px', borderRadius: '32px' }}><input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSend()} placeholder={agent ? "Ask anything..." : "API Key required"} disabled={!agent} style={{ flex: 1, border: 'none', background: 'transparent', fontSize: '15px', outline: 'none', color: '#111', fontWeight: '500' }} /><button onClick={() => handleSend()} disabled={!agent} style={{ backgroundColor: '#0054A6', color: '#fff', border: 'none', width: '44px', height: '44px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0, 84, 166, 0.3)', opacity: agent ? 1 : 0.5 }}><Send size={20} /></button></div></div>
    </div>
  );
};

const HomeView = ({ centers, onCardClick, onCategoryClick, searchQuery, setSearchQuery, onSearch }) => {
  const categories = [{ name: 'GED', Icon: BookOpenText }, { name: 'LCCI', Icon: Award }, { name: 'IELTS', Icon: GraduationCap }, { name: 'ENGLISH', Icon: Globe2 }, { name: 'JAPANESE', Icon: Globe2 }, { name: 'KOREAN', Icon: Globe2 }];
  const centerImages = { "Strategy First University": "https://strategyfirst.edu.mm/img/icon/s1st-portrait.png", "Language Center": "https://images.seeklogo.com/logo-png/32/1/wall-street-english-logo-png_seeklogo-324833.png", "KMD Center": "https://www.nccedu.com/wp-content/uploads/2021/03/Untitled-design.png", "default": "https://placehold.co/120x120/0054A6/ffffff?text=KBZPay" };
  return (
    <>
      <div className="sticky-search-section" style={{ position: 'sticky', top: '-1px', zIndex: 99, backgroundColor: '#0054A6', padding: '5px 25px 20px 25px', borderRadius: '0 0 25px 25px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
        <div className="search-container"><span className="search-icon-pos"><Search size={14} color="#888" /></span><input type="text" placeholder="Search for courses, school.." className="search-input" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') onSearch(searchQuery); }} /></div>
      </div>
      <BannerSlider />
      <div className="section" style={{ marginTop: '5px' }}>
        <h2 className="section-title">Popular Categories</h2>
        <div className="category-grid">{categories.map((cat) => (<div key={cat.name} className="category-box clickable" onClick={() => onCategoryClick(cat.name)}><div className="icon-wrapper"><cat.Icon size={26} color="#0054A6" strokeWidth={2.2} /></div><span style={{ color: '#333', fontWeight: '700', fontSize: '13px' }}>{cat.name}</span></div>))}</div>
      </div>
      <div className="section">
        <h2 className="section-title">Top Verified Centers</h2>
        {centers && centers.length > 0 ? centers.map((center) => {
          const imgSrc = centerImages[center.name] || centerImages["default"];
          return (<div key={center.id} className="center-card clickable" onClick={() => onCardClick(center.id)}><div className="card-content"><img src={imgSrc} alt={center.name} className="card-image" /><div className="card-text"><h3 className="center-name">{center.name}</h3><div className="center-location"><MapPin size={14} color="#0054A6" style={{marginRight: '6px'}}/> {center.location}</div><div className="center-rating"><Star size={14} fill="#ffcc00" color="#ffcc00" strokeWidth={0} style={{marginRight: '6px'}}/> {center.rating} rating</div></div></div></div>);
        }) : <p style={{ textAlign: 'center', color: '#888', fontSize: '13px', padding: '20px 0' }}>No centers found.</p>}
      </div>
    </>
  );
};

const BannerSlider = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const banners = [{ id: 1, image: "https://kmd.edu.mm/img/campus/room3.jpg" }, { id: 2, image: "https://strategyfirst.edu.mm/frontend/home_image/Pyay.webp" }, { id: 3, image: "https://infomyanmar.com/wp-content/uploads/2025/04/Arditorium-with-students_1-scaled-1.jpg" }];
  useEffect(() => {
    const timer = setInterval(() => { setCurrentSlide((prev) => (prev === banners.length - 1 ? 0 : prev + 1)); }, 4000);
    return () => clearInterval(timer);
  }, [banners.length]);
  return (
    <div style={{ position: 'relative', margin: '20px', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 10px 20px rgba(0,0,0,0.08)' }}>
      <div style={{ display: 'flex', transition: 'transform 0.5s ease-in-out', transform: `translateX(-${currentSlide * 100}%)` }}>{banners.map((banner) => (<img key={banner.id} src={banner.image} alt="Banner" style={{ width: '100%', minWidth: '100%', height: '170px', objectFit: 'cover' }} />))}</div>
      <div style={{ position: 'absolute', bottom: '12px', left: '0', right: '0', display: 'flex', justifyContent: 'center', gap: '8px' }}>{banners.map((_, idx) => (<div key={idx} onClick={() => setCurrentSlide(idx)} className="clickable" style={{ width: currentSlide === idx ? '18px' : '6px', height: '6px', borderRadius: '3px', backgroundColor: currentSlide === idx ? '#fff' : 'rgba(255,255,255,0.5)', transition: 'width 0.3s ease' }} />))}</div>
    </div>
  );
};

const DetailView = ({ center, onBack, onEnrollClick }) => {
  if (!center) return null;
  const galleryPhotos = ["https://kmd.edu.mm/img/campus/room3.jpg", "https://sisschools.org/sis-myanmar/wp-content/uploads/sites/19/2020/09/sis-myanmar-12.jpeg", "https://todaysparent.mblycdn.com/tp/resized/2025/09/1600x900/TP-x-PSG-Types-of-Private-Schools.png"];
  return (
    <div style={{ padding: '0 0 30px 0' }}>
      <div style={{ padding: '25px 20px', backgroundColor: '#fff', borderBottomLeftRadius: '30px', borderBottomRightRadius: '30px', boxShadow: '0 10px 25px rgba(0,0,0,0.04)', marginBottom: '25px' }}>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <img src={center.name === "Strategy First University" ? "https://strategyfirst.edu.mm/img/icon/s1st-portrait.png" : center.name === "Language Center" ? "https://images.seeklogo.com/logo-png/32/1/wall-street-english-logo-png_seeklogo-324833.png" : center.name === "KMD Center" ? "https://www.nccedu.com/wp-content/uploads/2021/03/Untitled-design.png" : "https://placehold.co/120x120/0054A6/ffffff?text=KBZPay"} alt={center.name} style={{ width: '80px', height: '80px', borderRadius: '20px', objectFit: 'cover' }} />
          <div><h2 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: '800', color: '#111' }}>{center.name}</h2><div className="center-location"><MapPin size={15} color="#0054A6" style={{marginRight: '6px'}}/> {center.location || 'Yangon'}</div><div className="center-rating"><Star size={15} fill="#ffcc00" color="#ffcc00" strokeWidth={0} style={{marginRight: '6px'}}/> {center.rating || 0} Rating</div></div>
        </div>
      </div>
      <div style={{ padding: '0 20px' }}>
        <h3 className="section-title">Campus Photos</h3>
        <div style={{ display: 'flex', gap: '15px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '15px', scrollbarWidth: 'none' }}>{galleryPhotos.map((photo, index) => (<img key={index} src={photo} alt={`Campus`} style={{ width: '200px', height: '130px', borderRadius: '16px', objectFit: 'cover', flexShrink: 0, boxShadow: '0 4px 10px rgba(0,0,0,0.06)' }} />))}</div>
        <h3 className="section-title">Location Map</h3>
        <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', marginBottom: '25px' }}>
          <iframe title="Center Location" width="100%" height="180" style={{ border: 0, borderRadius: '12px', marginBottom: '12px' }} loading="lazy" allowFullScreen src={`https://maps.google.com/maps?q=${encodeURIComponent(center.name + ' Yangon')}&t=&z=15&ie=UTF8&iwloc=&output=embed`}></iframe>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '0 5px' }}><MapPin size={20} color="#0054A6" style={{ marginTop: '2px', flexShrink: 0 }} /><div><div style={{ fontWeight: '700', fontSize: '14px', color: '#111', marginBottom: '4px' }}>{center.name} Campus</div><div style={{ fontSize: '12px', color: '#666', lineHeight: '1.5' }}>123 Education Street, {center.location || 'Yangon'}, Myanmar</div></div></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}><h3 className="section-title" style={{ margin: 0 }}>Available Courses</h3><span style={{ fontSize: '12px', fontWeight: '700', color: '#0054A6', backgroundColor: '#EAF7FC', padding: '4px 10px', borderRadius: '12px' }}>{center.courses ? center.courses.length : 0} Courses</span></div>
        {center.courses && center.courses.length > 0 ? center.courses.map((course, index) => (
          <div key={index} className="center-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1, paddingRight: '10px' }}><div style={{ fontWeight: '800', fontSize: '15px', color: '#111', marginBottom: '8px' }}>{course.title}</div><div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}><span style={{ backgroundColor: '#f5f5f5', color: '#555', padding: '4px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: '600' }}>{course.schedule || 'Sat-Sun'}</span><span style={{ backgroundColor: '#f5f5f5', color: '#555', padding: '4px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: '600' }}>{course.period || '3 Mths'}</span></div><div style={{ fontSize: '12px', color: '#0054A6', fontWeight: '700' }}>By: {course.instructor_name || 'Expert'}</div></div>
            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: '90px' }}><div style={{ fontWeight: '800', fontSize: '15px', color: '#0054A6', marginBottom: '12px' }}>{course.price ? Number(Array.isArray(course.price) ? course.price[0] : course.price).toLocaleString() : 0} <span style={{fontSize:'9px', color:'#888'}}>MMK</span></div><button onClick={() => onEnrollClick(course)} className="clickable confirm-btn" style={{ backgroundColor: '#0054A6', padding: '10px 20px', borderRadius: '15px', fontSize: '12px', color: 'white', border: 'none', fontWeight: 'bold' }}>Enroll</button></div>
          </div>
        )) : <p style={{ textAlign: 'center', color: '#888', fontSize: '13px', padding: '20px 0' }}>No courses available.</p>}
      </div>
    </div>
  );
};

const MenuView = ({ onBack, onCourseClick, onSchoolClick, onHistoryClick, onAboutClick, onContactClick }) => {
  const menuItems = [{ name: 'Home', icon: Home, action: onBack }, { name: 'Courses', icon: BookOpenText, action: onCourseClick }, { name: 'Verified Centers', icon: Award, action: onSchoolClick }, { name: 'My History', icon: History, action: onHistoryClick }, { name: 'About Us', icon: Info, action: onAboutClick }, { name: 'Contact Support', icon: Phone, action: onContactClick }];
  return (
    <div className="menu-container">
      <header className="header" style={{ display: 'flex', alignItems: 'center', padding: '25px 20px' }}><X onClick={onBack} className="clickable" color="white" size={28} /><h1 style={{ color: 'white', flex: 1, textAlign: 'center', fontSize: '18px', fontWeight: '800', margin: 0, paddingRight: '28px' }}>MENU</h1></header>
      <div className="menu-list-wrapper">{menuItems.map((item, idx) => (<div key={idx} className="menu-item clickable" onClick={item.action}><div className="menu-icon-bg"><item.icon size={20} strokeWidth={2.5} /></div><span className="menu-text">{item.name}</span><ChevronRight size={18} color="#ccc" /></div>))}</div>
      <div style={{ marginTop: 'auto', padding: '30px', textAlign: 'center' }}><p style={{ fontSize: '12px', fontWeight: '600', color: '#aaa' }}>Version 1.0.0</p><p style={{ fontSize: '12px', fontWeight: '600', color: '#aaa' }}>© 2026 KBZPay Education.</p></div>
    </div>
  );
};

const RegistrationFormView = ({ userProfile, enrollmentData, onConfirm, onBack }) => {
  const student = enrollmentData?.summary?.student_info || userProfile || {};
  return (
    <div className="overlay-container">
      <div className="overlay-header"><div style={{ display: 'flex', alignItems: 'center', marginBottom: '25px' }}><ChevronLeft size={28} onClick={onBack} className="clickable" /></div><div style={{ fontSize: '13px', fontWeight: '800', marginBottom: '5px' }}>20% <span style={{ fontWeight: '400', opacity: 0.8 }}>Completed</span></div><h2 style={{ margin: 0, fontSize: '24px', fontWeight: '800' }}>Personal Details</h2><div className="progress-bar-container"><div className="progress-dash active"></div><div className="progress-dash"></div><div className="progress-dash"></div><div className="progress-dash"></div></div></div>
      <div className="overlay-card">
        <h3 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '8px', color: '#111' }}>Registration</h3><p style={{ color: '#888', fontSize: '13px', marginBottom: '30px' }}>Please check your credentials to proceed.</p>
        <div className="modern-input-container"><span className="modern-input-label">Username</span><div className="modern-input-group"><User size={18} /><input type="text" defaultValue="Kyaw Kyaw" placeholder="Enter your name" /></div></div>
        <div className="modern-input-container"><span className="modern-input-label">Phone number</span><div className="modern-input-group"><Phone size={18} /><input type="text" defaultValue={student.phone || ""} placeholder="09xxxxxxxxx" /></div></div>
        <div className="modern-input-container" style={{ marginBottom: '40px' }}><span className="modern-input-label">Education Background</span><div className="modern-input-group"><FileText size={18} /><input type="text" defaultValue={student.education_background || "High School Graduate"} placeholder="e.g. B.Sc, High School" /></div></div>
        <button onClick={onConfirm} className="clickable" style={{ backgroundColor: '#0054A6', color: 'white', border: 'none', padding: '16px', borderRadius: '16px', fontWeight: 'bold', fontSize: '15px', marginTop: 'auto' }}>Confirm & Proceed</button>
      </div>
    </div>
  );
};

const ConfirmEnrollView = ({ data, selectedCenter, onRegister, onBack }) => {
  const summary = data?.summary || {};
  const actualPrice = Number(summary.price ?? 0);
  const displayPrice = Number.isFinite(actualPrice) ? actualPrice : 0;
  return (
    <div className="overlay-container">
      <div className="overlay-header"><div style={{ display: 'flex', alignItems: 'center', marginBottom: '25px' }}><ChevronLeft size={28} onClick={onBack} className="clickable" /></div><div style={{ fontSize: '13px', fontWeight: '800', marginBottom: '5px' }}>60% <span style={{ fontWeight: '400', opacity: 0.8 }}>Completed</span></div><h2 style={{ margin: 0, fontSize: '24px', fontWeight: '800' }}>Course Summary</h2><div className="progress-bar-container"><div className="progress-dash active"></div><div className="progress-dash active"></div><div className="progress-dash"></div><div className="progress-dash"></div></div></div>
      <div className="overlay-card">
        <h3 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '25px', color: '#111' }}>Enrollment Details</h3>
        <div style={{ marginBottom: '30px' }}>
          <div className="summary-row"><span className="summary-label"><MapPin size={16} /> Center Name</span><span className="summary-value">{summary.partnerName || selectedCenter?.name || "KBZPay Education"}</span></div>
          <div className="summary-row"><span className="summary-label"><BookOpenText size={16} /> Course</span><span className="summary-value" style={{ color: '#0054A6' }}>{summary.course_name || "N/A"}</span></div>
          <div className="summary-row"><span className="summary-label"><User size={16} /> Student Name</span><span className="summary-value">Kyaw Kyaw</span></div>
          <div className="summary-row" style={{ borderBottom: 'none', marginTop: '10px' }}><span className="summary-label" style={{ fontSize: '16px', color: '#111' }}>Total Amount</span><span className="summary-value" style={{ fontSize: '18px', color: '#0054A6' }}>{displayPrice.toLocaleString()} MMK</span></div>
        </div>
        <div style={{ display: 'flex', gap: '15px', marginTop: 'auto' }}><button onClick={onBack} className="clickable" style={{ flex: 1, backgroundColor: '#f0f0f0', color: '#333', border: 'none', padding: '16px', borderRadius: '16px', fontWeight: 'bold', fontSize: '15px' }}>Back</button><button onClick={onRegister} className="clickable" style={{ flex: 2, padding: '16px', borderRadius: '16px', border: 'none', backgroundColor: '#0054A6', color: 'white', fontWeight: 'bold', fontSize: '15px' }}>Next Step</button></div>
      </div>
    </div>
  );
};

const PaymentSuccessView = ({ result, selectedCenter, onDone }) => {
  const courseName = result?.course_name || result?.summary?.course_name || "Enrolled Course";
  let actualPrice = result?.amount || result?.summary?.Total_fees;
  if (!actualPrice) {
    const matchedCourse = selectedCenter?.courses?.find(c => c.title === courseName || c.course_name === courseName);
    const rawPrice = matchedCourse?.price || selectedCenter?.courses?.[0]?.price;
    actualPrice = Array.isArray(rawPrice) ? rawPrice[0] : (rawPrice || 0);
  }
  return (
    <div className="overlay-container">
      <div className="overlay-header" style={{ textAlign: 'center', paddingTop: '50px' }}><div style={{ fontSize: '13px', fontWeight: '800', marginBottom: '5px' }}>100% <span style={{ fontWeight: '400', opacity: 0.8 }}>Completed</span></div><h2 style={{ margin: 0, fontSize: '24px', fontWeight: '800' }}>Payment Successful</h2><div className="progress-bar-container" style={{ justifyContent: 'center', width: '60%', margin: '20px auto 0' }}><div className="progress-dash active"></div><div className="progress-dash active"></div><div className="progress-dash active"></div><div className="progress-dash active"></div></div></div>
      <div className="overlay-card" style={{ alignItems: 'center', textAlign: 'center' }}>
        <div style={{ backgroundColor: '#06C270', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', marginTop: '-75px', marginBottom: '25px', border: '6px solid white', boxShadow: '0 5px 15px rgba(6, 194, 112, 0.3)' }}><CheckCircle size={40} strokeWidth={2.5} /></div>
        <h3 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '5px', color: '#111' }}>Congratulations!</h3><p style={{ color: '#888', fontSize: '13px', marginBottom: '30px' }}>Your enrollment has been confirmed.</p>
        <div style={{ width: '100%', backgroundColor: '#f8f9fa', borderRadius: '20px', padding: '20px', textAlign: 'left', border: '1px solid #eee', marginBottom: '40px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', fontSize: '14px' }}><span style={{ fontWeight: '700', color: '#555' }}>Center</span><span style={{ fontWeight: '800', color: '#111' }}>{selectedCenter?.name || "N/A"}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', fontSize: '14px' }}><span style={{ fontWeight: '700', color: '#555' }}>Course</span><span style={{ fontWeight: '800', color: '#0054A6' }}>{courseName}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', borderTop: '1px dashed #ddd', paddingTop: '15px', marginTop: '5px' }}><span style={{ fontWeight: '700', color: '#555' }}>Amount Paid</span><span style={{ fontWeight: '900', color: '#111' }}>{actualPrice ? `${Number(actualPrice).toLocaleString()} MMK` : "0 MMK"}</span></div>
        </div>
        <button onClick={onDone} className="clickable" style={{ width: '100%', padding: '16px', borderRadius: '16px', fontSize: '15px', fontWeight: 'bold', border: 'none', backgroundColor: '#0054A6', color: '#fff', marginTop: 'auto' }}>Back to Home</button>
      </div>
    </div>
  );
};

const CourseListView = ({ courses, onEnrollClick, searchQuery, setSearchQuery, onSearch }) => (
  <div style={{ padding: '20px' }}>
    <div className="search-container"><span className="search-icon-pos"><Search size={14} color="#888" /></span><input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') onSearch(searchQuery); }} className="search-input" placeholder="Search for courses..." /></div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', marginBottom: '15px' }}><h2 className="section-title" style={{ margin: 0 }}>Results for "{searchQuery || 'All'}"</h2></div>
    {courses && courses.length > 0 ? courses.map((course, idx) => (
      <div key={idx} className="center-card"><div style={{ display: 'flex', justifyContent: 'space-between' }}><div><div style={{ fontWeight: '800', fontSize: '15px', color: '#111', marginBottom: '6px' }}>{course.title || course.name}</div><div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>{course.schedule || 'Sat - Sun'}</div><div style={{ fontSize: '12px', color: '#0054A6', fontWeight: '600' }}>{course.instructor_name ? `By: ${course.instructor_name}` : 'Expert'}</div></div><div style={{ textAlign: 'right' }}><div style={{ fontWeight: '800', fontSize: '15px', color: '#0054A6', marginBottom: '12px' }}>{course.price ? `${Number(course.price).toLocaleString()} MMK` : 'Free'}</div><button onClick={() => onEnrollClick(course)} className="clickable" style={{ backgroundColor: '#0054A6', padding: '8px 20px', borderRadius: '12px', fontSize: '12px', border: 'none', color: 'white', fontWeight: 'bold' }}>Enroll</button></div></div></div>
    )) : <div style={{ textAlign: 'center', padding: '40px 20px' }}><p style={{ color: '#888', fontWeight: '600' }}>No courses found.</p></div>}
  </div>
);

const SchoolListView = ({ centers, onCardClick, searchQuery, setSearchQuery, onSearch }) => (
  <div style={{ padding: '20px' }}>
    <div className="search-container"><span className="search-icon-pos"><Search size={14} color="#888" /></span><input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') onSearch(searchQuery); }} className="search-input" placeholder="Search for centers..." /></div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '25px', marginBottom: '15px' }}><h2 className="section-title" style={{ margin: 0 }}>{searchQuery ? `Results for "${searchQuery}"` : "All Centers"}</h2></div>
    {centers && centers.length > 0 ? centers.map((center) => (
      <div key={center.id} className="center-card clickable" onClick={() => onCardClick(center.id)}><div className="card-content"><img src="https://placehold.co/100x80/0054a6/ffffff?text=Center" alt="Center" className="card-image" /><div className="card-text"><h3 className="center-name">{center.name}</h3><div className="center-location"><MapPin size={14} color="#0054A6" style={{ marginRight: '6px'}} /> {center.location || "Yangon"}</div><div className="center-rating"><Star size={14} fill="#ffcc00" color="#ffcc00" strokeWidth={0} style={{ marginRight: '6px'}} /> {center.rating || "4.5"} rating</div></div></div></div>
    )) : <div style={{ textAlign: 'center', padding: '40px 20px' }}><p style={{ color: '#888', fontWeight: '600' }}>No centers found.</p></div>}
  </div>
);

const HistoryView = ({ histories }) => (
  <div style={{ padding: '20px' }}>
    <h2 className="section-title">Enrollment History</h2>
    {histories && histories.length > 0 ? histories.map((item, idx) => (
      <div key={item.id || idx} className="center-card" style={{ borderLeft: '6px solid #06C270' }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}><span style={{ fontSize: '11px', color: '#888', fontWeight: '700' }}>{item.student_name || item.enrollment_name || `TXN-${item.transaction_id || "Recent"}`}</span><span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '12px', backgroundColor: '#e2fbe8', color: '#06C270', fontWeight: 'bold' }}>{item.status || "Completed"}</span></div><div style={{ fontWeight: '800', fontSize: '16px', color: '#111', marginBottom: '6px' }}>{item.course?.title || "Unknown Course"}</div><div style={{ fontSize: '13px', color: '#666' }}>{item.center?.name || "Unknown Center"}</div><div style={{ textAlign: 'right', fontWeight: '900', color: '#0054A6', fontSize: '15px', marginTop: '15px' }}>{item.course?.price ? `${Number(item.course.price).toLocaleString()} MMK` : "0 MMK"}</div></div>
    )) : <div style={{ textAlign: 'center', padding: '40px 20px' }}><p style={{ color: '#888', fontWeight: '600' }}>No enrollment history found.</p></div>}
  </div>
);

const AboutUsView = () => (<div style={{ padding: '20px' }}><h2 className="section-title">About Us</h2><div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '24px', lineHeight: '1.8', boxShadow: '0 10px 30px rgba(0,0,0,0.03)' }}><p style={{ color: '#555', fontWeight: '500' }}>KBZPay Education is a dedicated platform designed to bridge the gap between students and top-tier educational institutions in Myanmar.</p></div></div>);
const ContactUsView = () => (<div style={{ padding: '20px' }}><h2 className="section-title">Contact Us</h2><div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.03)' }}><div style={{ marginBottom: '25px' }}><div style={{ fontWeight: '800', color: '#0054A6', marginBottom: '5px' }}>Hotline</div><div style={{ color: '#333', fontWeight: '600' }}>+95 9 123 456 789</div></div><div><div style={{ fontWeight: '800', color: '#0054A6', marginBottom: '5px' }}>Email</div><div style={{ color: '#333', fontWeight: '600' }}>support@kbzpay-edu.com</div></div></div></div>);
const TermsOfServiceView = () => <div style={{ padding: '20px' }}><h2 className="section-title">Terms of Service</h2></div>;
