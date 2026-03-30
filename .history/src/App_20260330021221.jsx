import React, { useState, useEffect } from 'react';
import './App.css'; 
import { Search, MapPin, Star, Menu as MenuIcon, Bell as BellIcon, BookOpenText, Award, GraduationCap, Globe2 } from 'lucide-react';

// 🌟 Localhost နဲ့ ဖုန်း (Mini App) အတွက် URL အလိုအလျောက် ပြောင်းပေးမည့် Function
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

 

  // ==========================================
  // 🌟 App စပွင့်တာနဲ့ Data တွေ ဆွဲယူမယ့် အပိုင်း
  // ==========================================
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

  // ==========================================
  // 🌟 အခြား API ခေါ်သည့် လုပ်ဆောင်ချက်များ
  // ==========================================
 
  useEffect(() => {
    if (currentPage === 'history') {
      fetchHistoryData();
    } else if (currentPage === 'courses') {
      handleSearch(searchQuery || "");
    } else if (currentPage === 'home') {
      setSearchQuery('');
      if (authToken) {
        fetchAllCenters();
      }
    }

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
        if (data && data.centers) {
          setCenters(data.centers); // Center အကုန်ပြန်ထည့်ပေးမယ်
        }
      }
    } catch (error) {
      console.error("Fetch All Centers Error:", error);
    }
  };

  const fetchHistoryData = async () => {
    setLoading(true);
    const historyUrl = getApiUrl("/service/ABH008_KST__Education/1.0.1/enrollments/history"); 
    try {
      const response = await fetch(historyUrl, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${authToken}`,
          'client_id': import.meta.env.VITE_CLIENT_ID
        }
      });
      if (!response.ok) throw new Error("History API Failed");
      const data = await response.json();
      setHistoryList(data.history || []);
    } catch (error) {
      console.error("History API Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCenterClick = async (centerId) => {
    setLoading(true);
    const detailApiUrl = getApiUrl("/service/ABH008_KST__Education/1.0.1/centers"); 
    try {
      const response = await fetch(detailApiUrl, {
        method: 'POST', 
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'client_id': import.meta.env.VITE_CLIENT_ID
        },
        body: JSON.stringify({ center_id: centerId }) 
      });
      if (!response.ok) throw new Error("Detail API failed");
      const data = await response.json();
      setSelectedCenter(data); 
      setCurrentPage('detail'); 
    } catch (error) {
      console.error("Detail API Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (keyword) => {
    setLoading(true);
    const searchApiUrl = getApiUrl("/service/ABH008_KST__Education/1.0.1/search"); 
    try {
      const response = await fetch(searchApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'client_id': import.meta.env.VITE_CLIENT_ID
        },
        body: JSON.stringify({ q: keyword || "" })
      });
      if (!response.ok) throw new Error("Search API error");
      const data = await response.json();
      const actualResults = data.result?.results || [];
      const newCenters = [];
      const newCourses = [];
      actualResults.forEach(item => {
        if (item.type === 'center') {
          newCenters.push({ id: item.id, name: item.name, location: item.location || 'Yangon', rating: item.rating ? item.rating[0] : 0, tabs: item.tabs || [] });
        } else if (item.type === 'course') {
          newCourses.push({ id: item.course_id, title: item.title, schedule: item.schedule, period: item.period, instructor_name: item.instructor_name, price: Array.isArray(item.price) ? item.price[0] : (item.price || 0), service_year: item.service_year });
        }
      });
      setCenters(newCenters);
      setCourses(newCourses);
      if (newCourses.length > 0 && currentPage !== 'courses') setCurrentPage('courses');
    } catch (error) {
      console.error("Search API Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryClick = (catName) => {
    setSearchQuery(catName);
    setCurrentPage('courses');
  };

  const handleEnrollmentRequest = async (course) => {
    setLoading(true);
    const requestUrl = getApiUrl("/service/ABH008_KST__Education/1.0.1/enrollment/request");
    try {
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'client_id': import.meta.env.VITE_CLIENT_ID
        },
        body: JSON.stringify({ center_id: selectedCenter?.center_id || "", course_id: course.id || course.course_id || "" })
      });
      const data = await response.json();
      if (data.resCode === "0") {
        setEnrollmentRequestData(data.result); 
        setCurrentPage('confirm');
      }
    } catch (error) {
      console.error("Request API Error:", error);
    } finally {
      setLoading(false);
    }
  };

const handleConfirmEnrollment = async () => {
    setLoading(true);
    
    //  Payment API လမ်းကြောင်း)
    const appCubeOrderApiUrl = getApiUrl("/service/ABH008_KST__Education/1.0.0/payment"); 
    
    const summary = enrollmentRequestData?.result?.summary || enrollmentRequestData?.summary || {};
    const matchedCourse = selectedCenter?.courses?.find(c => c.title === summary.course_name || c.course_name === summary.course_name);
    
    const rawPrice = matchedCourse?.price || selectedCenter?.courses?.[0]?.price;
    const actualPrice = Array.isArray(rawPrice) ? rawPrice[0] : (rawPrice || 0);

    try {
      const response = await fetch(appCubeOrderApiUrl, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          'client_id': import.meta.env.VITE_CLIENT_ID
        },
        body: JSON.stringify({ 
          amount: Number(actualPrice) || 1000, 
          orderId: "ORD_" + Date.now() 
        })
      });

      if (!response.ok) throw new Error("Order API Failed");
      
      const rawData = await response.json(); 
      console.log("AppCube Raw Response:", rawData); // Log တွင် စစ်ဆေးရန်

      // 🌟 ပြင်ဆင်ချက်: AppCube ရဲ့ result အိတ်လေးထဲကနေ Data ကို ဆွဲထုတ်လိုက်တာပါ
      const orderData = rawData.result || rawData;

      // Data အလွတ်ကြီး ဖြစ်နေမလား ထပ်စစ်ပေးထားပါတယ်
      if (!orderData || !orderData.orderInfo) {
          throw new Error("Order Info is missing from Backend");
      }

      if (window.ma && window.ma.callNativeAPI) {
        window.ma.callNativeAPI("startPay", {
          prepayId: orderData.preOrderId, 
          orderInfo: orderData.orderInfo.orderInfo, 
          sign: orderData.orderInfo.sign, 
          signType: orderData.orderInfo.signType || "SHA256",
          useMiniResultFlag: true, 
        }, (res) => {
          console.log("Finish Pay Callback:", res);
          if (res.resultCode == 1 || res.resultCode == "1") {
            const successApiUrl = getApiUrl("/service/ABH008_KST__Education/1.0.1/payment/success");
            
            // Enrollment ID ကို ယူခြင်း (Backend က ပြန်လာတဲ့ Data ပေါ်မူတည်၍ ပြင်နိုင်ပါသည်)
            const enrollId = enrollmentRequestData?.result?.id || enrollmentRequestData?.id || summary?.id;

            fetch(successApiUrl, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
                'client_id': import.meta.env.VITE_CLIENT_ID
              },
              body: JSON.stringify({ 
                transaction_id: orderData.preOrderId, // ငွေပေးချေမှု ID
                enrollment_id: enrollId // Database ထဲက Enrollment ID
              })
            }).then(response => response.json())
              .then(data => console.log("DB Updated to SUCCESS:", data))
              .catch(err => console.error("DB Update Failed:", err));
            // =========================================================
            const successData = {
               ...orderData,
               course_name: summary.course_name // Course Name ပါအောင် ထည့်ပေးထားသည်
            };
            setEnrollmentResult(successData); 
            setCurrentPage('success'); 
          } else {
            alert("Payment was cancelled or failed. Please try again.");
          }
        });
      } else {
        console.log("Browser mode: Skipping KBZPay StartPay.");
        const successData = { ...orderData, course_name: summary.course_name };
        setEnrollmentResult(successData);
        setCurrentPage('success');
      }
      
    } catch (error) {
      console.error("Payment Process Error:", error);
      alert("Something went wrong with the payment request. Check vConsole.");
    } finally {
      setLoading(false);
    }
  };
// React ဘက်က Auto Login လုပ်မည့် Function
// (မှတ်ချက် - ဒီ Function ကို ခေါ်တဲ့အခါ AppCube ရဲ့ Token ကို ထည့်ပေးဖို့ လိုပါတယ်)
const handleAutoLogin = (currentAuthToken) => {
  if (window.ma && window.ma.getAuthCode) {
    // 1. KBZPay ဆီကနေ authCode အရင်တောင်းမယ်
    window.ma.getAuthCode({
      scopes: ['USER_NICKNAME', 'PLAINTEXT_MOBILE_PHONE'], // KBZPay ကနေ နာမည်နဲ့ ဖုန်းနံပါတ် တောင်းရန်
      success: async (res) => {
        try {
          const appCubeLoginUrl = getApiUrl("/service/ABH008_KST__Education/1.0.1/AutoLogin"); 
          
          const response = await fetch(appCubeLoginUrl, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              // 🌟 ဒီ Header (၂) ကြောင်း မပါမဖြစ် လိုအပ်ပါတယ်
              'Authorization': `Bearer ${currentAuthToken}`, 
              'client_id': import.meta.env.VITE_CLIENT_ID
            },
            body: JSON.stringify({ 
               authCode: res.authCode 
            })
          });

          if (!response.ok) throw new Error("AppCube Login API Failed");

          const data = await response.json();
          console.log("Auto Login Success Data:", data);

          // 🌟 ဒီနေရာမှာ User Data ရပြီဆိုရင် App ထဲကို တန်းဝင်ခိုင်းလို့ ရပါပြီ
          const userInfo = data?.userInfo || data?.result?.userInfo || data; 
          if (userInfo) {
             // ဥပမာ -
             // setUserProfile({
             //   name: userInfo.USER_NICKNAME || userInfo.name || "Testing User",
             //   phone: userInfo.PLAINTEXT_MOBILE_PHONE || userInfo.usrName || "0912345678"
             // });
          }

        } catch (error) {
          console.error("AppCube Login API Error:", error);
        }
      },
      fail: (err) => {
        console.error("KBZPay AuthCode Error:", err);
      }
    });
  } else {
    console.log("Browser mode: Skipping KBZPay Auto Login");
  }
};

  // ==========================================
  // 🌟 MAIN UI RENDER 
  // ==========================================
  return (
    <div className="browser-center-wrapper">
      <div className="phone-container">
        {currentPage !== 'success' && currentPage !== 'menu' && (
          <header className="header">
            <div className="header-top">
              {currentPage === 'home' ? (
                <MenuIcon className="clickable" onClick={() => setCurrentPage('menu')} color="white" size={26} strokeWidth={2.5} />
              ) : (
                <span className="clickable" onClick={() => {
                      if (currentPage === 'registration') setCurrentPage('confirm');
                      else if (currentPage === 'confirm') setCurrentPage('detail');
                      else if (currentPage === 'courses' && searchQuery !== '') { setCurrentPage('home'); setSearchQuery(''); }
                      else if (['courses', 'schools', 'history', 'about', 'contact', 'terms'].includes(currentPage)) setCurrentPage('menu');
                      else setCurrentPage('home');
                  }} style={{ fontSize: '24px' }}>←</span>
              )}
              <h1 className="header-title">KBZPAY EDUCATION</h1>
              <BellIcon color="white" size={24} strokeWidth={2.5} />
            </div>
          </header>
        )}

        <div className="scroll-container">
          {loading && currentPage !== 'home' ? (
             <div style={{ padding: '60px', textAlign: 'center', color: '#888', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
               <div className="spinner"></div>
               <p style={{ fontWeight: '600' }}>Loading...</p>
             </div>
          ) : (
             <>
                {currentPage === 'home' && (<HomeView centers={centers} onCardClick={handleCenterClick} onSearch={handleSearch} onCategoryClick={handleCategoryClick} searchQuery={searchQuery} setSearchQuery={setSearchQuery} />)}
                
                {currentPage === 'detail' && (<DetailView center={selectedCenter} onBack={() => setCurrentPage('home')} onEnrollClick={handleEnrollmentRequest} />)}
                
                {currentPage === 'confirm' && (<ConfirmEnrollView data={enrollmentRequestData} selectedCenter={selectedCenter} onRegister={() => setCurrentPage('registration')} onBack={() => setCurrentPage('detail')} />)}
                
                {currentPage === 'registration' && (<RegistrationFormView userProfile={userProfile} enrollmentData={enrollmentRequestData} onConfirm={handleConfirmEnrollment} onBack={() => setCurrentPage('confirm')} />)}
                
                {currentPage === 'success' && (<PaymentSuccessView result={enrollmentResult} selectedCenter={selectedCenter} onDone={() => {setCurrentPage('home');setEnrollmentResult(null);}} />)}
                
                {currentPage === 'menu' && (<MenuView onBack={() => { setCurrentPage('home'); setSearchQuery(''); }} onCourseClick={() => setCurrentPage('courses')} onSchoolClick={() => setCurrentPage('schools')} onHistoryClick={() => setCurrentPage('history')} onAboutClick={() => setCurrentPage('about')} onContactClick={() => setCurrentPage('contact')} onTermsClick={() => setCurrentPage('terms')} />)}
                
                {currentPage === 'courses' && (<CourseListView courses={courses} onEnrollClick={() => setCurrentPage('confirm')} searchQuery={searchQuery} setSearchQuery={setSearchQuery} onSearch={handleSearch} />)}
                
                {currentPage === 'schools' && (<SchoolListView centers={centers} onCardClick={handleCenterClick} searchQuery={searchQuery} setSearchQuery={setSearchQuery} onSearch={handleSearch}  />)}
                
                {currentPage === 'history' && <HistoryView histories={historyList} />}
                
                {currentPage === 'about' && <AboutUsView />}
                {currentPage === 'contact' && <ContactUsView />}
                {currentPage === 'terms' && <TermsOfServiceView />}
             </>
          )}
        </div>
      </div>
    </div>
  );
}

// ==========================================
//                 VIEWS (UI Components)
// ==========================================

const HomeView = ({ centers, onCardClick, onCategoryClick, searchQuery, setSearchQuery, onSearch }) => {
  const categories = [
    { name: 'GED', Icon: BookOpenText, color: '#FF6B6B', bg: '#FFF0F0' },
    { name: 'LCCI', Icon: Award, color: '#4D96FF', bg: '#F0F6FF' },
    { name: 'IELTS', Icon: GraduationCap, color: '#9D4EDD', bg: '#F8F0FF' },
    { name: 'ENGLISH', Icon: Globe2, color: '#F4A261', bg: '#FFF7F0' },
    { name: 'JAPANESE', Icon: Globe2, color: '#2A9D8F', bg: '#F0FFF8' },
    { name: 'KOREAN', Icon: Globe2, color: '#00B4D8', bg: '#F0FAFF' }
  ];

  return (
    <>
      <div className="search-section">
        <div className="search-container">
          <span className="search-icon-pos"><Search size={20} color="#888" /></span>
          <input 
              type="text" 
              placeholder="Search for courses, school.." 
              className="search-input" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onSearch(searchQuery); }}
          />
        </div>
      </div>
      
      <div className="section">
        <h2 className="section-title">Popular Categories</h2>
        <div className="category-grid">
          {categories.map((cat) => (
            <div key={cat.name} className="category-box clickable" onClick={() => onCategoryClick(cat.name)}>
              <div className="icon-wrapper" style={{ backgroundColor: cat.bg }}>
                 <cat.Icon size={24} color={cat.color} strokeWidth={2.5} />
              </div>
              {cat.name}
            </div>
          ))}
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">Top Verified Centers</h2>
        {centers && centers.length > 0 ? (
          centers.map((center) => (
            <div key={center.id} className="center-card clickable" onClick={() => onCardClick(center.id)}>
              <div className="card-content">
                <img src="https://placehold.co/120x120/4a3aff/ffffff?text=Center" alt="Center" className="card-image" />
                <div className="card-text">
                  <h3 className="center-name">{center.name}</h3>
                  <div className="center-location"><MapPin size={14} style={{ marginRight: '6px', color: '#a0a0a0' }} /> {center.location}</div>
                  <div className="center-rating"><Star size={14} fill="#ffb800" style={{ marginRight: '6px', color: '#ffb800', strokeWidth: 0 }} /> {center.rating} rating</div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p style={{ textAlign: 'center', color: '#888', fontSize: '13px', padding: '20px 0' }}>No centers found.</p>
        )}
      </div>
    </>
  );
};

const DetailView = ({ center, onBack, onEnrollClick }) => {
  if (!center) return null;

  return (
    <div style={{ padding: '0 0 30px 0' }}>
      <div style={{ padding: '25px 20px', backgroundColor: '#fff', borderBottomLeftRadius: '30px', borderBottomRightRadius: '30px', boxShadow: '0 10px 25px rgba(0,0,0,0.04)', marginBottom: '25px' }}>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <img src="https://placehold.co/120x120/4a3aff/ffffff?text=Center" alt="Center" style={{ width: '85px', height: '85px', borderRadius: '22px', objectFit: 'cover', boxShadow: '0 8px 20px rgba(74,58,255,0.2)' }} />
          <div>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '800', color: '#1a1a1a' }}>{center.name}</h2>
            <div className="center-location"><MapPin size={15} style={{ marginRight: '6px', color: '#d9534f' }} /> {center.location || 'Yangon'}</div>
            <div className="center-rating"><Star size={15} style={{ marginRight: '6px', color: '#ffcc00' }} fill="#ffcc00" strokeWidth={0} /> {center.rating || 0} Rating</div>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 20px' }}>
        <h3 className="section-title">About Center</h3>
        <p style={{ fontSize: '14px', color: '#555', lineHeight: '1.7', backgroundColor: 'white', padding: '18px 20px', borderRadius: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', marginBottom: '25px', border: '1px solid #fdfdfd' }}>
          {center.description || "Established as a quality education provider in Myanmar. Offering the best learning experience with highly qualified instructors."}
        </p>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3 className="section-title" style={{ margin: 0 }}>Available Courses</h3>
          <span style={{ fontSize: '12px', fontWeight: '700', color: '#4a3aff', backgroundColor: '#eef0ff', padding: '4px 10px', borderRadius: '12px' }}>
            {center.courses ? center.courses.length : 0} Courses
          </span>
        </div>

        {center.courses && center.courses.length > 0 ? (
          center.courses.map((course, index) => (
            <div key={index} className="center-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1, paddingRight: '10px' }}>
                <div style={{ fontWeight: '800', fontSize: '16px', color: '#1a1a1a', marginBottom: '8px' }}>{course.title}</div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                  <span style={{ backgroundColor: '#f5f5f5', color: '#555', padding: '5px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: '600' }}>{course.schedule || 'Sat-Sun'}</span>
                  <span style={{ backgroundColor: '#f5f5f5', color: '#555', padding: '5px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: '600' }}>{course.period || '3 Months'}</span>
                </div>
                <div style={{ fontSize: '12px', color: '#4a3aff', fontWeight: '700' }}>By: {course.instructor_name || 'Expert Instructor'}</div>
              </div>
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: '90px' }}>
                <div style={{ fontWeight: '800', fontSize: '15px', color: '#4a3aff', marginBottom: '12px' }}>{course.price ? Number(Array.isArray(course.price) ? course.price[0] : course.price).toLocaleString() : 0} <span style={{fontSize:'10px', color:'#888'}}>MMK</span></div>
                
                <button onClick={() => onEnrollClick(course)} className="clickable confirm-btn" style={{ padding: '10px 22px', borderRadius: '20px', fontSize: '13px' }}>Enroll</button>
              </div>
            </div>
          ))
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 20px', backgroundColor: 'white', borderRadius: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <MapPin size={40} color="#ccc" style={{ marginBottom: '15px' }} />
            <p style={{ color: '#888', fontSize: '13px', margin: 0, fontWeight: '700' }}>No courses available yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const CourseListView = ({ courses, onEnrollClick, searchQuery, setSearchQuery, onSearch }) => {
  return (
    <div style={{ padding: '20px' }}>
      <div className="search-container">
        <span className="search-icon-pos"><Search size={20} color="#888" /></span>
        <input 
            type="text" 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSearch(searchQuery); }}
            className="search-input" 
            placeholder="Search for courses..."
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', marginBottom: '15px' }}>
        <h2 className="section-title" style={{ margin: 0 }}>Results for "{searchQuery || 'All'}"</h2>
        <button className="clickable" style={{ backgroundColor: '#e0e0e0', border: 'none', padding: '6px 14px', borderRadius: '15px', fontSize: '12px', color: '#333', fontWeight: '600' }}>All Filters</button>
      </div>

      {courses && courses.length > 0 ? courses.map((course, idx) => (
        <div key={idx} className="center-card">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: '800', fontSize: '15px', color: '#000', marginBottom: '6px' }}>{course.title || course.name}</div>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>{course.schedule || 'Sat - Sun'}</div>
              <div style={{ fontSize: '12px', color: '#4a3aff', fontWeight: '600' }}>{course.instructor_name ? `By: ${course.instructor_name}` : 'Mr. Aung Aung'}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: '800', fontSize: '15px', color: '#4a3aff', marginBottom: '12px' }}>
                {course.price ? `${Number(course.price).toLocaleString()} MMK` : 'Free'}
              </div>
              <button onClick={() => onEnrollClick(course)} className="clickable confirm-btn" style={{ padding: '8px 20px', borderRadius: '15px', fontSize: '12px' }}>Enroll</button>
            </div>
          </div>
        </div>
      )) : (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}><p style={{ color: '#888', fontWeight: '600' }}>No courses found.</p></div>
      )}
    </div>
  );
};

const RegistrationFormView = ({ userProfile, enrollmentData, onConfirm, onBack }) => {
  const student = enrollmentData?.summary?.student_info || userProfile || {};

  return (
    <div style={{ padding: '20px' }}>
      <h2 className="section-title" style={{ textAlign: 'center' }}>Student Registration Form</h2>
      <div style={{ backgroundColor: 'white', borderRadius: '30px', padding: '30px 25px' }}>
        
        <div style={{ marginBottom: '20px' }}>
          <span style={{ fontWeight: '700', fontSize: '13px' }}>Name</span>
          <input type="text" defaultValue={student.name || ""} className="form-input" />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <span style={{ fontWeight: '700', fontSize: '13px' }}>Phone</span>
          <input type="text" defaultValue={student.phone || ""} className="form-input" />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <span style={{ fontWeight: '700', fontSize: '13px' }}>Education Background</span>
          <input type="text" defaultValue={student.education_background || ""} className="form-input" />
        </div>

        <div style={{ marginTop: '30px' }}>
          <button onClick={onConfirm} className="clickable confirm-btn">Confirm Enrollment</button>
        </div>
      </div>
    </div>
  );
};

const ConfirmEnrollView = ({ data, selectedCenter, onRegister, onBack }) => {
  const summary = data?.summary || {};
  const currentCourse = selectedCenter?.courses?.find(c => c.title === summary.course_name);
  const rawPrice = currentCourse?.price || selectedCenter?.courses?.[0]?.price;
   const actualPrice = Array.isArray(rawPrice) ? rawPrice[0] : (rawPrice || 0);
  return (
    <div style={{ padding: '20px' }}>
      <h2 className="section-title" style={{ textAlign: 'center', color: '#3832a8' }}>Confirm Enrollment</h2>
      
      <div style={{ backgroundColor: 'white', borderRadius: '24px', padding: '25px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
        <h3 style={{ textAlign: 'center', marginBottom: '25px', fontSize: '18px', color: 'black', fontWeight: '800' }}>Course Summary</h3>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', fontSize: '14px' }}>
          <span style={{ color: '#777' }}>Center Name:</span>
          <span style={{ fontWeight: '700', color: '#111' }}>{selectedCenter?.name || "N/A"}</span>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', fontSize: '14px' }}>
          <span style={{ color: '#777' }}>Course:</span>
          <span style={{ fontWeight: '700', color: '#111' }}>{summary.course_name || "N/A"}</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', fontSize: '14px' }}>
          <span style={{ color: '#777' }}>Student Name:</span>
          <span style={{ fontWeight: '700', color: '#111' }}>{summary.student_info?.name || "miniapp_user"}</span>
        </div>

        <div style={{ borderTop: '1px solid #eee', margin: '20px 0', paddingTop: '20px', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '18px', fontWeight: '900', color: '#3832a8' }}>Total:</span>
          <span style={{ fontSize: '18px', fontWeight: '900', color: '#3832a8' }}>
            {Number(actualPrice).toLocaleString()} MMK
          </span>
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: '15px', marginTop: '30px' }}>
          <button onClick={onRegister} className="clickable confirm-btn" style={{ flex: 1, padding: '16px', borderRadius: '16px', border: 'none', color: 'white', fontWeight: 'bold', fontSize: '15px' }}>Register Now</button>
          <button onClick={onBack} className="clickable" style={{ flex: 1, backgroundColor: '#f0f0f0', color: '#333', border: 'none', padding: '16px', borderRadius: '16px', fontWeight: 'bold', fontSize: '15px' }}>Back</button>
      </div>
    </div>
  );
};

const PaymentSuccessView = ({ result, selectedCenter, onDone }) => {
  // 🌟 N/A မဖြစ်အောင် အဆင့်ဆင့် လိုက်ရှာပေးတဲ့ Code ပါ
  const courseName = result?.course_name || result?.summary?.course_name || result?.result?.summary?.course_name || "Enrolled Course";
  
  const centerName = selectedCenter?.name || "N/A";
  
  // စျေးနှုန်း ရှာခြင်း
  let actualPrice = result?.amount || result?.summary?.Total_fees;
  if (!actualPrice) {
    const matchedCourse = selectedCenter?.courses?.find(c => c.title === courseName || c.course_name === courseName);
    const rawPrice = matchedCourse?.price || selectedCenter?.courses?.[0]?.price;
    actualPrice = Array.isArray(rawPrice) ? rawPrice[0] : (rawPrice || 0);
  }

  return (
    <div style={{ backgroundColor: '#ffffff', height: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      
      <header className="header" style={{ width: '100%' }}>
        <div className="header-top" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', padding: '15px 20px' }}>
          <h1 className="header-title" style={{ margin: 0, fontSize: '16px', letterSpacing: '1px' }}>KBZPAY EDUCATION</h1>
        </div>
      </header>

      <div style={{ padding: '40px 20px', textAlign: 'center', width: '100%', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ backgroundColor: '#4a89f3', width: '90px', height: '90px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '10px auto 25px auto', color: 'white', fontSize: '45px', boxShadow: '0 10px 25px rgba(74, 137, 243, 0.3)' }}>✓</div>
        <h2 style={{ fontSize: '22px', fontWeight: '900', marginBottom: '30px', color: '#111' }}>Payment Successful</h2>

        <div style={{ backgroundColor: '#f8f9fa', borderRadius: '16px', padding: '25px', textAlign: 'left', border: '1px solid #eee', width: '100%', maxWidth: '320px', marginBottom: '40px' }}>
          <div style={{ fontWeight: '800', marginBottom: '20px', fontSize: '15px', color: '#333' }}>Enrollment Confirm</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', fontSize: '14px' }}>
            <span style={{ fontWeight: '800', color: '#555' }}>Center:</span>
            <span style={{ fontWeight: '800', color: '#111', textAlign: 'right' }}>{centerName}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', fontSize: '14px' }}>
            <span style={{ fontWeight: '800', color: '#555' }}>Course:</span>
            {/* 🌟 Course နာမည် မှန်မှန်ကန်ကန် ပေါ်လာပါပြီ */}
            <span style={{ fontWeight: '800', color: '#111', textAlign: 'right' }}>{courseName}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', borderTop: '1px solid #ddd', paddingTop: '15px', marginTop: '5px' }}>
            <span style={{ fontWeight: '800', color: '#555' }}>Amount:</span>
            <span style={{ fontWeight: '900', color: '#3832a8' }}>{actualPrice ? `${Number(actualPrice).toLocaleString()} MMK` : "0 MMK"}</span>
          </div>
        </div>

        <button onClick={onDone} className="clickable confirm-btn" style={{ width: '100%', maxWidth: '320px', padding: '16px', borderRadius: '16px', fontSize: '15px', fontWeight: 'bold', border: 'none', color: '#fff' }}>DONE</button>
        <div style={{ marginTop: 'auto', padding: '20px 0', fontSize: '11px', color: '#aaa', fontWeight: '600' }}>Secure Payment Powered By KBZPay</div>
      </div>
    </div>
  );
};

// 🌟 Menu ကို အစအဆုံး ပြန်ထည့်ထားပါပြီ
const MenuView = ({ onBack, onCourseClick, onSchoolClick, onHistoryClick, onAboutClick, onContactClick, onTermsClick }) => (
  <div style={{ backgroundColor: '#f8f9fc', height: '100%', display: 'flex', flexDirection: 'column' }}>
    <header className="header">
      <div className="header-top">
        <MenuIcon onClick={onBack} className="clickable" color="white" size={26} />
        <h1 className="header-title">MENU</h1>
        <div style={{ width: '24px' }}></div>
      </div>
    </header>
    <div style={{ padding: '30px 20px' }}>
      <div style={{ backgroundColor: 'white', borderRadius: '24px', padding: '10px 0', boxShadow: '0 15px 35px rgba(0,0,0,0.05)' }}>
        {['Home', 'Course', 'School', 'History', 'About Us', 'Contact Us'].map((item, idx) => (
          <div 
            key={idx} 
            className="clickable"
            onClick={() => {
              if (item === 'Home') onBack();
              else if (item === 'Course') onCourseClick();
              else if (item === 'School') onSchoolClick();
              else if (item === 'History') onHistoryClick();
              else if (item === 'About Us') onAboutClick();
              else if (item === 'Contact Us') onContactClick();
            }}
            style={{ padding: '18px 25px', fontSize: '15px', fontWeight: '700', color: '#333', borderBottom: idx === 5 ? 'none' : '1px solid #f0f0f0' }}
          >
            {item}
          </div>
        ))}
      </div>
      <div style={{ marginTop: '50px', textAlign: 'center' }}>
        <p style={{ fontSize: '12px', fontWeight: '600', color: '#aaa' }}>© 2025 KBZPay Education.</p>
      </div>
    </div>
  </div>
);

// 🌟 History ကို အစအဆုံး ပြန်ထည့်ထားပါပြီ
const HistoryView = ({ histories }) => (
  <div style={{ padding: '20px' }}>
    <h2 className="section-title">Enrollment History</h2>
    
    {histories && histories.length > 0 ? (
      histories.map((item, idx) => (
        <div key={item.id || idx} className="center-card" style={{ borderLeft: '6px solid #4CAF50', backgroundColor: 'white', padding: '20px', borderRadius: '15px', marginBottom: '15px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '11px', color: '#888', fontWeight: '700' }}>
              {item.enrollment_name || `TXN-${item.transaction_id || "Recent"}`}
            </span>
            <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '12px', backgroundColor: '#e8f5e9', color: '#2e7d32', fontWeight: 'bold' }}>
              {item.status || "Completed"}
            </span>
          </div>

          <div style={{ fontWeight: '800', fontSize: '16px', color: '#111', marginBottom: '6px' }}>
            {item.course?.title || "Unknown Course"}
          </div>
          <div style={{ fontSize: '13px', color: '#666' }}>
            {item.center?.name || "Unknown Center"}
          </div>

          <div style={{ textAlign: 'right', fontWeight: '900', color: '#3832a8', fontSize: '15px', marginTop: '15px' }}>
            {item.course?.price ? `${Number(item.course.price).toLocaleString()} MMK` : "0 MMK"}
          </div>
        </div>
      ))
    ) : (
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <p style={{ color: '#888', fontWeight: '600' }}>No enrollment history found.</p>
      </div>
    )}
  </div>
);
///////

const handlePayment = async (payData) => {
  // payData ဆိုတာက Backend (AppCube) ကနေ ပြန်ရလာတဲ့ Result ပါ
  window.ma.callNativeAPI("startPay", {
    prepayId: payData.prepay_id,
    orderInfo: payData.orderinfo,
    sign: payData.sign,
    signType: "SHA256",
    useMiniResultFlag: true, // KBZPay ရဲ့ Payment Success စာမျက်နှာကို သုံးမယ်လို့ ပြောတာ
  }, (res) => {
    if (res.resultCode == 1) {
      // ပိုက်ဆံချေတာ အောင်မြင်သွားရင် လုပ်ချင်တာ ဆက်လုပ်ပါ
      console.log("Payment Successful!");
      setCurrentPage('success'); 
    } else {
      // ပိုက်ဆံမချေဖြစ်ဘဲ ပိတ်လိုက်ရင် ဒါမှမဟုတ် Error တက်ရင်
      alert("Payment failed or cancelled.");
    }
  });
};

// 🌟 School List ကို အစအဆုံး ပြန်ထည့်ထားပါပြီ
const SchoolListView = ({ centers, onCardClick, searchQuery, setSearchQuery, onSearch }) => {
  return (
    <div style={{ padding: '20px' }}>
      <div className="search-container">
        <span className="search-icon-pos"><Search size={20} color="#888" /></span>
        <input 
            type="text" 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSearch(searchQuery); }}
            className="search-input" 
            placeholder="Search for centers..."
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '25px', marginBottom: '15px' }}>
        <h2 className="section-title" style={{ margin: 0 }}>
          {searchQuery ? `Results for "${searchQuery}"` : "All Centers"}
        </h2>
      </div>

      {centers && centers.length > 0 ? (
        centers.map((center) => (
          <div key={center.id} className="center-card clickable" onClick={() => onCardClick(center.id)}>
              <div className="card-content">
                <img src="https://placehold.co/100x80/4a3aff/ffffff?text=Center" alt="Center" className="card-image" />
                <div className="card-text">
                  <h3 className="center-name">{center.name}</h3>
                  <div className="center-location">
                    <MapPin size={14} style={{ marginRight: '6px', color: '#a0a0a0' }} /> 
                    {center.location || "Yangon"}
                  </div>
                  <div className="center-rating">
                    <Star size={14} fill="#ffb800" style={{ marginRight: '6px', color: '#ffb800', strokeWidth: 0 }} /> 
                    {center.rating || "4.5"} rating
                  </div>
                </div>
              </div>
          </div>
        ))
      ) : (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p style={{ color: '#888', fontWeight: '600' }}>No centers found.</p>
        </div>
      )}
    </div>
  );
};

// 🌟 About Us နဲ့ Contact Us ကို အစအဆုံး ပြန်ထည့်ထားပါပြီ
const AboutUsView = () => (
  <div style={{ padding: '20px' }}>
    <h2 className="section-title">About Us</h2>
    <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '24px', lineHeight: '1.8', boxShadow: '0 10px 30px rgba(0,0,0,0.03)' }}>
      <p style={{ color: '#555', fontWeight: '500' }}>KBZPay Education is a dedicated platform designed to bridge the gap between students and top-tier educational institutions in Myanmar.</p>
    </div>
  </div>
);

const ContactUsView = () => (
  <div style={{ padding: '20px' }}>
    <h2 className="section-title">Contact Us</h2>
    <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.03)' }}>
      <div style={{ marginBottom: '25px' }}><div style={{ fontWeight: '800', color: '#3832a8', marginBottom: '5px' }}>Hotline</div><div style={{ color: '#333', fontWeight: '600' }}>+95 9 123 456 789</div></div>
      <div><div style={{ fontWeight: '800', color: '#3832a8', marginBottom: '5px' }}>Email</div><div style={{ color: '#333', fontWeight: '600' }}>support@kbzpay-edu.com</div></div>
    </div>
  </div>
);

const TermsOfServiceView = () => <div style={{ padding: '20px' }}><h2 className="section-title">Terms of Service</h2></div>;