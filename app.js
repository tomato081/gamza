/**
 * ==========================================================================
 * 감자 (Gamza) 중고 거래 웹 서비스 통합 스크립트 (app.js)
 * Supabase DB 연동: profiles, products, wishes
 * Supabase Auth 연동: 회원가입, 로그인, 로그아웃, 상태별 UI 전환
 * ==========================================================================
 */

(function () {
  'use strict';

  // --- Supabase 설정 및 초기화 ---
  const SUPABASE_URL = "https://wpiwzghncdztkftzzylq.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwaXd6Z2huY2R6dGtmdHp6eWxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0ODAzNjksImV4cCI6MjEwODA1NjM2OX0.UF2yxywmPotQAH6vsB48Lmce6R-_y5RmGa8AUOVHOXw";
  
  // 브라우저에 로드된 Supabase 클라이언트
  const supabase = (window.supabase && typeof window.supabase.createClient === 'function')
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

  // 비식별화된 기본 사용자 ID (비로그인 상태 또는 오프라인 Fallback)
  const FALLBACK_USER_ID = "00000000-0000-0000-0000-000000000000";

  // 1. 초기 Fallback 데이터
  const FALLBACK_PRODUCTS = [];

  // 2. 전역 상태
  const state = {
    products: [...FALLBACK_PRODUCTS],
    selectedCategory: "전체",
    onlyAvailable: false,
    searchKeyword: "",
    currentDetailProduct: null,
    editingProductId: null, // 수정 중인 상품 ID
    writeImageData: "",
    isLoading: false,
    currentUser: null,       // Supabase auth user 객체
    currentProfile: null,    // DB profiles 레코드 { id, nickname, avatar_url, activity_location, manner_temp, cert_count }
    pendingActionAfterLogin: null, // 로그인 성공 후 자동 실행할 작업 (예: 'openWriteModal')
    currentAuthTab: "login"  // 'login' | 'signup'
  };

  // 3. 유틸리티 함수
  function formatRelativeTime(dateString) {
    if (!dateString) return "방금 전";
    const date = new Date(dateString);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);
    if (diffSec < 60) return "방금 전";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}분 전`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}시간 전`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 7) return `${diffDay}일 전`;
    return date.toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
  }

  function formatPrice(amount) {
    if (amount === 0 || amount === '0') return "나눔 🧡";
    return Number(amount).toLocaleString("ko-KR") + "원";
  }

  function getStatusClass(status) {
    switch (status) {
      case "판매중": return "status-sale";
      case "예약중": return "status-reserved";
      case "거래 완료": return "status-completed";
      default: return "status-sale";
    }
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str).replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }

  function showToast(message) {
    let toast = document.getElementById("gamza-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "gamza-toast";
      toast.className = "gamza-toast";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.classList.remove("show");
    }, 2400);
  }

  // ==========================================================================
  // [Supabase Auth] 인증 및 프로필 관리 로직
  // ==========================================================================

  /**
   * profiles 테이블에서 사용자의 프로필을 조회하고 없으면 생성(upsert)
   */
  async function ensureUserProfile(user, preferredNickname, preferredLocation) {
    if (!supabase || !user) return null;
    try {
      // 1) profiles 테이블 조회
      const { data: existing, error: selectErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (existing) {
        // 이미 프로필이 있고, 만약 별도로 변경된 닉네임이 있다면 업데이트
        if (preferredNickname && existing.nickname !== preferredNickname) {
          const { data: updated } = await supabase
            .from('profiles')
            .update({ nickname: preferredNickname, updated_at: new Date().toISOString() })
            .eq('id', user.id)
            .select()
            .single();
          return updated || existing;
        }
        return existing;
      }

      // 2) 프로필이 없으면 신규 생성
      const defaultNickname = preferredNickname || 
        user.user_metadata?.nickname || 
        (user.email ? user.email.split('@')[0] : '감자이웃');
      const defaultLocation = preferredLocation || 
        user.user_metadata?.activity_location || 
        '역삼동';
      const defaultAvatar = user.user_metadata?.avatar_url || 
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80';

      const newProfile = {
        id: user.id,
        nickname: defaultNickname,
        avatar_url: defaultAvatar,
        activity_location: defaultLocation,
        manner_temp: 36.5,
        cert_count: 1
      };

      const { data: inserted, error: insertErr } = await supabase
        .from('profiles')
        .insert([newProfile])
        .select()
        .single();

      if (insertErr) {
        console.warn("프로필 insert 에러 (이미 존재할 수 있음):", insertErr);
        return newProfile;
      }
      return inserted || newProfile;
    } catch (err) {
      console.error("ensureUserProfile 실패:", err);
      return null;
    }
  }

  /**
   * 현재 로그인 상태에 맞추어 우상단 헤더 버튼 UI를 전환
   * - 로그인 전: [로그인] 버튼만 표시
   * - 로그인 후: [로그인] 숨김 처리, [닉네임]과 [로그아웃] 버튼만 표시
   */
  function updateAuthUI() {
    const btnLogin = document.getElementById("gamza-btn-login");
    const userMenu = document.getElementById("gamza-user-menu");
    const nicknameEl = document.getElementById("gamza-user-nickname");

    if (state.currentUser) {
      if (btnLogin) btnLogin.style.display = "none";
      if (userMenu) userMenu.style.display = "flex";
      if (nicknameEl) {
        const nickname = state.currentProfile?.nickname || 
          state.currentUser.user_metadata?.nickname || 
          (state.currentUser.email ? state.currentUser.email.split('@')[0] : "감자이웃");
        nicknameEl.textContent = nickname;
      }
    } else {
      if (btnLogin) btnLogin.style.display = "";
      if (userMenu) userMenu.style.display = "none";
    }
  }

  /**
   * Supabase Auth 초기 세션 로드 및 리스너 등록
   */
  async function initAuth() {
    if (!supabase) return;

    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (session?.user) {
        state.currentUser = session.user;
        state.currentProfile = await ensureUserProfile(session.user);
      } else {
        state.currentUser = null;
        state.currentProfile = null;
      }
      updateAuthUI();

      // 세션 변경 리스너
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          state.currentUser = session.user;
          state.currentProfile = await ensureUserProfile(session.user);
          updateAuthUI();
        } else if (event === 'SIGNED_OUT') {
          state.currentUser = null;
          state.currentProfile = null;
          updateAuthUI();
        }
      });
    } catch (err) {
      console.error("Auth 초기화 오류:", err);
      updateAuthUI();
    }
  }

  // ==========================================================================
  // [인증 모달] 열기 / 닫기 / 탭 전환 / 오류 메시지
  // ==========================================================================
  function openAuthModal(tab = "login", noticeMessage = "") {
    const modal = document.getElementById("authModalBackdrop");
    const noticeEl = document.getElementById("authNoticeBanner");
    if (!modal) return;

    switchAuthTab(tab);

    if (noticeEl) {
      if (noticeMessage) {
        noticeEl.innerHTML = `<span>🥔</span> <span>${escapeHtml(noticeMessage)}</span>`;
        noticeEl.style.display = "flex";
      } else {
        noticeEl.innerHTML = "";
        noticeEl.style.display = "none";
      }
    }

    clearAuthErrors();
    modal.classList.add("active");
    document.body.classList.add("modal-open");

    // 첫 번째 입력 필드에 포커스
    setTimeout(() => {
      const input = (tab === "login") 
        ? document.getElementById("loginEmail") 
        : document.getElementById("signupEmail");
      if (input) input.focus();
    }, 150);
  }

  function closeAuthModal() {
    const modal = document.getElementById("authModalBackdrop");
    if (modal) {
      modal.classList.remove("active");
    }
    document.body.classList.remove("modal-open");
    clearAuthErrors();
  }

  function switchAuthTab(tab) {
    state.currentAuthTab = tab;
    const loginTabBtn = document.getElementById("authTabLogin");
    const signupTabBtn = document.getElementById("authTabSignup");
    const loginForm = document.getElementById("gamzaLoginForm");
    const signupForm = document.getElementById("gamzaSignupForm");
    const modalTitle = document.getElementById("authModalTitle");
    const modalDesc = document.getElementById("authModalDesc");

    clearAuthErrors();

    if (tab === "login") {
      if (loginTabBtn) loginTabBtn.classList.add("active");
      if (signupTabBtn) signupTabBtn.classList.remove("active");
      if (loginForm) loginForm.style.display = "flex";
      if (signupForm) signupForm.style.display = "none";
      if (modalTitle) modalTitle.textContent = "따뜻한 감자마을 로그인";
      if (modalDesc) modalDesc.textContent = "동네 이웃과 따뜻한 중고거래를 시작해보세요!";
    } else {
      if (signupTabBtn) signupTabBtn.classList.add("active");
      if (loginTabBtn) loginTabBtn.classList.remove("active");
      if (signupForm) signupForm.style.display = "flex";
      if (loginForm) loginForm.style.display = "none";
      if (modalTitle) modalTitle.textContent = "감자마을 이웃 가입하기";
      if (modalDesc) modalDesc.textContent = "닉네임을 등록하고 이웃들과 안심 거래하세요!";
    }
  }

  function clearAuthErrors() {
    const loginErr = document.getElementById("loginErrorMessage");
    const signupErr = document.getElementById("signupErrorMessage");
    if (loginErr) {
      loginErr.style.display = "none";
      loginErr.textContent = "";
    }
    if (signupErr) {
      signupErr.style.display = "none";
      signupErr.textContent = "";
    }
  }

  function showAuthError(type, message) {
    const errEl = document.getElementById(type === "login" ? "loginErrorMessage" : "signupErrorMessage");
    if (errEl) {
      errEl.textContent = message;
      errEl.style.display = "block";
    }
  }

  /**
   * 로그인 제출 핸들러
   */
  async function handleLoginSubmit(e) {
    e.preventDefault();
    clearAuthErrors();

    if (!supabase) {
      alert("Supabase 클라이언트가 초기화되지 않았습니다.");
      return;
    }

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    if (!email) {
      showAuthError("login", "이메일 계정을 입력해주세요.");
      document.getElementById("loginEmail").focus();
      return;
    }
    if (!password) {
      showAuthError("login", "비밀번호를 입력해주세요.");
      document.getElementById("loginPassword").focus();
      return;
    }

    const submitBtn = document.getElementById("btnLoginSubmit");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "로그인 중... 🥔";
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        let msg = error.message;
        if (msg.includes("Invalid login credentials")) {
          msg = "이메일 또는 비밀번호가 올바르지 않습니다.";
        } else if (msg.includes("Email not confirmed")) {
          msg = "이메일 인증이 완료되지 않았습니다. 메일함을 확인해주세요.";
        }
        showAuthError("login", msg);
        return;
      }

      if (data?.user) {
        state.currentUser = data.user;
        state.currentProfile = await ensureUserProfile(data.user);
        updateAuthUI();
        closeAuthModal();

        const nick = state.currentProfile?.nickname || "감자이웃";
        showToast(`🥔 반갑습니다, '${nick}'님!`);

        // 사용자 찜 목록 및 전체 목록 새로고침
        await fetchProductsFromSupabase();

        // [요구사항] 글쓰기를 눌렀다가 로그인 모달이 뜬 경우, 로그인 성공 시 글쓰기 창 이어서 띄우기
        if (state.pendingActionAfterLogin === "openWriteModal") {
          state.pendingActionAfterLogin = null;
          setTimeout(() => {
            openWriteModal();
          }, 300);
        }
      }
    } catch (err) {
      console.error("로그인 예외:", err);
      showAuthError("login", "로그인 처리 중 문제가 발생했습니다: " + (err.message || err));
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "로그인";
      }
    }
  }

  /**
   * 회원가입 제출 핸들러 (닉네임 필수)
   */
  async function handleSignupSubmit(e) {
    e.preventDefault();
    clearAuthErrors();

    if (!supabase) {
      alert("Supabase 클라이언트가 초기화되지 않았습니다.");
      return;
    }

    const email = document.getElementById("signupEmail").value.trim();
    const password = document.getElementById("signupPassword").value;
    const nickname = document.getElementById("signupNickname").value.trim();
    const location = document.getElementById("signupLocation").value.trim() || "역삼동";

    if (!email) {
      showAuthError("signup", "이메일 계정을 입력해주세요.");
      document.getElementById("signupEmail").focus();
      return;
    }
    if (!password || password.length < 6) {
      showAuthError("signup", "비밀번호는 최소 6자 이상이어야 합니다.");
      document.getElementById("signupPassword").focus();
      return;
    }
    // [요구사항] 회원가입할 때 닉네임도 필수로 입력받기
    if (!nickname) {
      showAuthError("signup", "닉네임은 필수 항목입니다. 닉네임을 입력해주세요!");
      document.getElementById("signupNickname").focus();
      return;
    }

    const submitBtn = document.getElementById("btnSignupSubmit");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "가입 처리 중... 🥔";
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            nickname,
            activity_location: location
          }
        }
      });

      if (error) {
        let msg = error.message;
        if (msg.includes("User already registered") || msg.includes("already registered")) {
          msg = "이미 가입되어 있는 이메일 계정입니다. 로그인해주세요.";
        } else if (msg.includes("Password should be")) {
          msg = "비밀번호는 최소 6자 이상이어야 합니다.";
        } else if (msg.includes("valid email")) {
          msg = "올바른 이메일 주소를 입력해주세요.";
        }
        showAuthError("signup", msg);
        return;
      }

      if (data?.user) {
        // DB profiles 테이블에 닉네임과 함께 저장
        const profile = await ensureUserProfile(data.user, nickname, location);

        if (data.session) {
          // 이메일 인증 불필요 설정인 경우 바로 세션 부여됨
          state.currentUser = data.user;
          state.currentProfile = profile;
          updateAuthUI();
          closeAuthModal();

          showToast(`🎉 환영합니다! '${nickname}'님으로 회원가입 및 로그인되었습니다.`);

          await fetchProductsFromSupabase();

          // 대기 중인 글쓰기 작업이 있다면 모달 오픈
          if (state.pendingActionAfterLogin === "openWriteModal") {
            state.pendingActionAfterLogin = null;
            setTimeout(() => {
              openWriteModal();
            }, 300);
          }
        } else {
          // 이메일 인증이 필요한 프로젝트 설정인 경우
          closeAuthModal();
          alert(`🎉 '${nickname}'님 회원가입이 완료되었습니다!\n확인 메일을 보냈으니 메일함의 링크를 클릭한 후 로그인해주세요.`);
          openAuthModal("login", "이메일 인증 링크를 확인하신 후 로그인해주세요.");
        }
      }
    } catch (err) {
      console.error("회원가입 예외:", err);
      showAuthError("signup", "회원가입 중 오류가 발생했습니다: " + (err.message || err));
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "회원가입 완료";
      }
    }
  }

  /**
   * 로그아웃 핸들러
   */
  async function handleLogout() {
    if (!supabase) return;
    try {
      await supabase.auth.signOut();
      state.currentUser = null;
      state.currentProfile = null;
      state.pendingActionAfterLogin = null;
      updateAuthUI();
      showToast("🥔 로그아웃 되었습니다. 다음에 또 만나요!");
      fetchProductsFromSupabase();
    } catch (err) {
      console.error("로그아웃 실패:", err);
      showToast("로그아웃 중 문제가 발생했습니다.");
    }
  }

  // ==========================================================================
  // [Supabase 데이터 연동] 상품 목록 & 찜 상태 조회
  // ==========================================================================
  async function fetchProductsFromSupabase() {
    if (!supabase) {
      console.warn("Supabase 클라이언트가 로드되지 않아 로컬 데이터를 사용합니다.");
      renderProductList();
      return;
    }

    try {
      state.isLoading = true;
      const countEl = document.getElementById("gamza-result-count-num");
      if (countEl) countEl.textContent = "...";

      // 1. 상품 및 판매자 정보 JOIN 조회
      const { data: productsData, error: prodErr } = await supabase
        .from('products')
        .select(`
          id,
          seller_id,
          title,
          category,
          price,
          location,
          status,
          image_url,
          description,
          created_at,
          seller:profiles (
            id,
            nickname,
            avatar_url,
            activity_location,
            manner_temp,
            cert_count
          )
        `)
        .order('created_at', { ascending: false });

      if (prodErr) throw prodErr;

      // 2. 현재 로그인 사용자의 찜 목록 조회
      const currentUserId = state.currentUser ? state.currentUser.id : FALLBACK_USER_ID;
      const { data: wishesData } = await supabase
        .from('wishes')
        .select('product_id')
        .eq('user_id', currentUserId);

      const wishedSet = new Set((wishesData || []).map(w => String(w.product_id)));

      // 3. UI 바인딩용 데이터 모델 변환
      state.products = (productsData || []).map(item => ({
        id: item.id,
        sellerId: item.seller_id || (item.seller ? item.seller.id : null),
        title: item.title,
        category: item.category,
        price: item.price,
        location: item.location,
        uploadTime: formatRelativeTime(item.created_at),
        status: item.status,
        image: item.image_url,
        description: item.description,
        isWished: wishedSet.has(String(item.id)),
        seller: item.seller ? {
          id: item.seller.id,
          nickname: item.seller.nickname || "동네이웃",
          avatar: item.seller.avatar_url || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
          location: item.seller.activity_location || item.location,
          mannerTemp: Number(item.seller.manner_temp) || 36.5,
          certCount: item.seller.cert_count || 1
        } : {
          id: item.seller_id,
          nickname: "동네이웃",
          avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
          location: item.location,
          mannerTemp: 36.5,
          certCount: 1
        }
      }));

    } catch (err) {
      console.error("Supabase 데이터 로드 실패:", err);
      showToast("🥔 실시간 데이터를 불러오는 중 문제가 발생했습니다.");
    } finally {
      state.isLoading = false;
      renderProductList();
    }
  }

  // ==========================================================================
  // [화면 1] 상품 목록 렌더링 & 필터링 (카드에 작성자 닉네임 표시)
  // ==========================================================================
  function renderProductList() {
    const grid = document.getElementById("gamza-product-grid");
    const countEl = document.getElementById("gamza-result-count-num");
    if (!grid) return;

    // 카테고리 + 거래가능(거래 완료 제외) + 검색어 필터링
    const filtered = state.products.filter(item => {
      const matchCategory = state.selectedCategory === "전체" || item.category === state.selectedCategory;
      const matchAvailable = !state.onlyAvailable || item.status !== "거래 완료";
      const q = state.searchKeyword.trim().toLowerCase();
      const matchKeyword = !q || 
        item.title.toLowerCase().includes(q) || 
        item.location.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        (item.seller && item.seller.nickname.toLowerCase().includes(q));

      return matchCategory && matchAvailable && matchKeyword;
    });

    if (countEl) countEl.textContent = filtered.length;

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="empty-product-state">
          <div class="empty-state-icon">🥔</div>
          <h3 class="empty-state-title">조건에 맞는 상품이 없어요</h3>
          <p class="empty-state-desc">다른 검색어를 입력하시거나 카테고리 필터를 변경해 보세요.</p>
          <button type="button" class="gamza-btn-secondary" id="btn-reset-filters">
            필터 초기화
          </button>
        </div>
      `;
      const resetBtn = document.getElementById("btn-reset-filters");
      if (resetBtn) {
        resetBtn.addEventListener("click", resetFilters);
      }
      return;
    }

    grid.innerHTML = filtered.map(item => {
      const statusClass = getStatusClass(item.status);
      const sellerNick = item.seller ? item.seller.nickname : "동네이웃";

      return `
        <article class="product-card" data-id="${item.id}" data-status="${item.status}">
          <div class="card-thumbnail-box">
            <img class="card-thumbnail-img" src="${item.image}" alt="${escapeHtml(item.title)}" loading="lazy" />
            <span class="status-badge card-status-badge ${statusClass}">${item.status}</span>
            <div class="card-overlay-completed"></div>
          </div>
          <div class="card-body">
            <span class="card-category">${item.category}</span>
            <h3 class="card-title">${escapeHtml(item.title)}</h3>
            <div class="card-meta">
              <span>${escapeHtml(item.location)}</span>
              <span class="card-meta-dot">•</span>
              <time>${item.uploadTime}</time>
              <span class="card-meta-dot">•</span>
              <!-- [요구사항] 목록 카드에 글쓴이 닉네임 표시 -->
              <span class="card-seller-name" title="작성자: ${escapeHtml(sellerNick)}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px; margin-right:2px; opacity:0.85;">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>${escapeHtml(sellerNick)}
              </span>
            </div>
            <div class="card-price-row">
              <span class="card-price">${formatPrice(item.price)}</span>
            </div>
          </div>
        </article>
      `;
    }).join("");

    // 각 카드 클릭 시 상세 모달 오픈
    grid.querySelectorAll(".product-card").forEach(card => {
      card.addEventListener("click", () => {
        const id = card.getAttribute("data-id");
        openDetailModal(id);
      });
    });
  }

  function resetFilters() {
    state.selectedCategory = "전체";
    state.onlyAvailable = false;
    state.searchKeyword = "";

    const searchInput = document.getElementById("gamza-search-input");
    if (searchInput) searchInput.value = "";

    const toggle = document.getElementById("gamza-toggle-available");
    if (toggle) toggle.checked = false;

    document.querySelectorAll(".category-chip").forEach(chip => {
      if (chip.getAttribute("data-category") === "전체") {
        chip.classList.add("active");
      } else {
        chip.classList.remove("active");
      }
    });

    renderProductList();
  }

  // ==========================================================================
  // [화면 2] 상세 팝업 (모달) 로직 (상세 모달에 글쓴이 닉네임 표시)
  // ==========================================================================
  function openDetailModal(productId) {
    const product = state.products.find(p => String(p.id) === String(productId));
    if (!product) return;

    state.currentDetailProduct = product;

    const modal = document.getElementById("detailModalBackdrop");
    if (!modal) return;

    // 데이터 바인딩
    const imgEl = document.getElementById("detailProductImage");
    if (imgEl) {
      imgEl.src = product.image;
      imgEl.alt = product.title;
    }

    const statusBadge = document.getElementById("detailStatusBadge");
    if (statusBadge) {
      statusBadge.className = `status-badge ${getStatusClass(product.status)}`;
      statusBadge.textContent = product.status;
    }
    const catTag = document.getElementById("detailCategoryTag");
    if (catTag) catTag.textContent = product.category;

    const titleEl = document.getElementById("detailProductTitle");
    if (titleEl) titleEl.textContent = product.title;

    const locEl = document.getElementById("detailLocationText");
    if (locEl) locEl.textContent = product.location;
    const timeEl = document.getElementById("detailUploadTimeText");
    if (timeEl) timeEl.textContent = product.uploadTime;

    const priceEl = document.getElementById("detailPriceText");
    if (priceEl) priceEl.textContent = formatPrice(product.price);

    const descEl = document.getElementById("detailDescriptionText");
    if (descEl) descEl.textContent = product.description;

    // [요구사항] 상세 모달에 글쓴이 닉네임 및 판매자 정보 표시
    const seller = product.seller || {
      nickname: "따뜻한감자",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
      location: product.location,
      mannerTemp: 36.5,
      certCount: 1
    };

    const sellerAvatar = document.getElementById("detailSellerAvatar");
    if (sellerAvatar) sellerAvatar.src = seller.avatar;

    const sellerNick = document.getElementById("detailSellerNickname");
    if (sellerNick) sellerNick.textContent = seller.nickname;

    const sellerLoc = document.getElementById("detailSellerLocation");
    if (sellerLoc) sellerLoc.textContent = `${seller.location} · 동네인증 ${seller.certCount}회`;

    const sellerManner = document.getElementById("detailSellerManner");
    if (sellerManner) sellerManner.textContent = `${Number(seller.mannerTemp).toFixed(1)}°C`;

    // [요구사항] 작성자 본인인지 확인하여 수정/삭제/상태선택 UI 노출 전환
    const isAuthor = Boolean(
      state.currentUser && (
        (product.sellerId && String(state.currentUser.id) === String(product.sellerId)) ||
        (product.seller && product.seller.id && String(state.currentUser.id) === String(product.seller.id))
      )
    );

    const authorStatusSection = document.getElementById("detailAuthorStatusSection");
    const buyerActionBar = document.getElementById("detailBuyerActionBar");
    const authorActionBar = document.getElementById("detailAuthorActionBar");

    if (isAuthor) {
      if (authorStatusSection) {
        authorStatusSection.style.display = "flex";
        authorStatusSection.querySelectorAll(".btn-status-toggle").forEach(btn => {
          btn.classList.toggle("active", btn.getAttribute("data-status") === product.status);
        });
      }
      if (buyerActionBar) buyerActionBar.style.display = "none";
      if (authorActionBar) authorActionBar.style.display = "flex";
    } else {
      if (authorStatusSection) authorStatusSection.style.display = "none";
      if (buyerActionBar) buyerActionBar.style.display = "flex";
      if (authorActionBar) authorActionBar.style.display = "none";
    }

    // 하단 관심 상태 업데이트
    updateWishButtonState();

    // 모달 표시
    modal.classList.add("active");
    document.body.classList.add("modal-open");
  }

  /**
   * [요구사항] 자신이 쓴 글에서 판매중/예약중/거래 완료 선택 시 Supabase DB 및 UI 실시간 업데이트
   */
  async function handleDetailStatusChange(newStatus) {
    const product = state.currentDetailProduct;
    if (!product) return;
    if (product.status === newStatus) return;

    const prevStatus = product.status;
    product.status = newStatus;

    // 상세 모달 배지 및 상태 버튼 UI 즉시 갱신
    const statusBadge = document.getElementById("detailStatusBadge");
    if (statusBadge) {
      statusBadge.className = `status-badge ${getStatusClass(newStatus)}`;
      statusBadge.textContent = newStatus;
    }

    const authorStatusSection = document.getElementById("detailAuthorStatusSection");
    if (authorStatusSection) {
      authorStatusSection.querySelectorAll(".btn-status-toggle").forEach(btn => {
        btn.classList.toggle("active", btn.getAttribute("data-status") === newStatus);
      });
    }

    // 목록 리스트 동기화 및 렌더링
    const targetInList = state.products.find(p => String(p.id) === String(product.id));
    if (targetInList) targetInList.status = newStatus;
    renderProductList();

    if (supabase) {
      try {
        const { error } = await supabase
          .from('products')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', product.id);

        if (error) throw error;
        showToast(`🥔 거래 상태가 '${newStatus}'(으)로 변경되었습니다!`);
      } catch (err) {
        console.error("상태 변경 실패:", err);
        // 오류 시 이전 상태로 롤백
        product.status = prevStatus;
        if (targetInList) targetInList.status = prevStatus;
        if (statusBadge) {
          statusBadge.className = `status-badge ${getStatusClass(prevStatus)}`;
          statusBadge.textContent = prevStatus;
        }
        if (authorStatusSection) {
          authorStatusSection.querySelectorAll(".btn-status-toggle").forEach(btn => {
            btn.classList.toggle("active", btn.getAttribute("data-status") === prevStatus);
          });
        }
        renderProductList();
        showToast("거래 상태를 변경하지 못했습니다.");
      }
    } else {
      showToast(`🥔 거래 상태가 '${newStatus}'(으)로 변경되었습니다!`);
    }
  }

  /**
   * [요구사항] 자신이 쓴 게시글 수정 시작
   */
  function handleStartEdit() {
    const product = state.currentDetailProduct;
    if (!product) return;

    state.editingProductId = product.id;

    // 모달 헤더 및 버튼 텍스트 변경
    const heading = document.getElementById("writeModalHeading");
    if (heading) heading.textContent = "게시글 수정 🥔";
    const submitBtn = document.querySelector("#gamzaWriteForm button[type='submit']");
    if (submitBtn) submitBtn.textContent = "수정 완료";

    // 폼 값 채우기
    const titleInput = document.getElementById("writeTitle");
    if (titleInput) titleInput.value = product.title || "";

    const categorySelect = document.getElementById("writeCategory");
    if (categorySelect) categorySelect.value = product.category || "";

    const priceInput = document.getElementById("writePrice");
    if (priceInput) priceInput.value = (product.price !== undefined && product.price !== null) ? product.price : "";

    const locationInput = document.getElementById("writeLocation");
    if (locationInput) locationInput.value = product.location || "";

    const descInput = document.getElementById("writeDescription");
    if (descInput) descInput.value = product.description || "";

    // 상태 라디오 채우기
    const targetRadio = document.querySelector(`input[name="writeStatus"][value="${product.status}"]`);
    if (targetRadio) {
      targetRadio.checked = true;
    }
    updateStatusRadioLabels();

    // 이미지 채우기
    if (product.image) {
      updateImagePreview(product.image);
      const urlInput = document.getElementById("writeImageUrlInput");
      if (urlInput) urlInput.value = product.image;
    } else {
      updateImagePreview("");
    }

    // 상세 모달 닫고 글쓰기(수정) 모달 열기
    closeDetailModal();

    const writeModal = document.getElementById("writeModalBackdrop");
    if (writeModal) {
      writeModal.classList.add("active");
      document.body.classList.add("modal-open");
    }
  }

  /**
   * [요구사항] 자신이 쓴 게시글 삭제
   */
  async function handleDeleteProduct() {
    const product = state.currentDetailProduct;
    if (!product) return;

    const ok = confirm(`'${product.title}' 게시글을 정말 삭제하시겠습니까?\n삭제된 게시글은 되돌릴 수 없습니다.`);
    if (!ok) return;

    const deleteBtn = document.getElementById("detailDeleteBtn");
    if (deleteBtn) {
      deleteBtn.disabled = true;
      deleteBtn.textContent = "삭제 중...";
    }

    try {
      if (supabase) {
        const { error } = await supabase
          .from('products')
          .delete()
          .eq('id', product.id);

        if (error) throw error;
      } else {
        state.products = state.products.filter(p => String(p.id) !== String(product.id));
      }

      closeDetailModal();
      await fetchProductsFromSupabase();
      showToast("🥔 게시글이 성공적으로 삭제되었습니다.");
    } catch (err) {
      console.error("게시글 삭제 실패:", err);
      alert("게시글 삭제 중 오류가 발생했습니다: " + (err.message || err));
    } finally {
      if (deleteBtn) {
        deleteBtn.disabled = false;
        deleteBtn.innerHTML = `
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
          <span>게시글 삭제</span>
        `;
      }
    }
  }

  function closeDetailModal() {
    const modal = document.getElementById("detailModalBackdrop");
    if (modal) {
      modal.classList.remove("active");
    }
    document.body.classList.remove("modal-open");
  }

  async function toggleWish() {
    if (!state.currentDetailProduct) return;

    // 비로그인 사용자일 경우 로그인 유도 안내
    if (!state.currentUser) {
      openAuthModal("login", "관심 상품에 등록하려면 로그인이 필요해요 🥔");
      return;
    }

    const product = state.currentDetailProduct;
    const willWish = !product.isWished;
    const userId = state.currentUser.id;

    // UI 낙관적 업데이트
    product.isWished = willWish;
    updateWishButtonState();

    const targetInList = state.products.find(p => String(p.id) === String(product.id));
    if (targetInList) targetInList.isWished = willWish;

    if (willWish) {
      showToast("🥔 관심 목록에 추가되었습니다!");
    } else {
      showToast("관심 목록에서 제외되었습니다.");
    }

    if (!supabase) return;

    try {
      if (willWish) {
        const { error } = await supabase
          .from('wishes')
          .insert([{ user_id: userId, product_id: product.id }]);
        if (error && error.code !== '23505') throw error;
      } else {
        const { error } = await supabase
          .from('wishes')
          .delete()
          .eq('user_id', userId)
          .eq('product_id', product.id);
        if (error) throw error;
      }
    } catch (err) {
      console.error("관심 등록/해제 실패:", err);
      // 롤백
      product.isWished = !willWish;
      if (targetInList) targetInList.isWished = !willWish;
      updateWishButtonState();
      showToast("관심 상태를 저장하지 못했습니다.");
    }
  }

  function updateWishButtonState() {
    const wishBtn = document.getElementById("detailWishBtn");
    if (!wishBtn || !state.currentDetailProduct) return;
    if (state.currentDetailProduct.isWished) {
      wishBtn.classList.add("wished");
    } else {
      wishBtn.classList.remove("wished");
    }
  }

  // ==========================================================================
  // [화면 3] 글쓰기 화면 (모달) 로직
  // ==========================================================================
  const SAMPLE_IMAGES = [
    { name: "포슬감자", url: "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=800&auto=format&fit=crop&q=80" },
    { name: "노트북", url: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&auto=format&fit=crop&q=80" },
    { name: "소파/의자", url: "https://images.unsplash.com/photo-1580481077195-c3f915f01908?w=800&auto=format&fit=crop&q=80" },
    { name: "헤드폰", url: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80" }
  ];

  function openWriteModal() {
    // [요구사항] 로그인을 하지 않은 상태에서 [글쓰기]를 누르면 로그인 모달이 먼저 뜨고
    if (!state.currentUser) {
      state.pendingActionAfterLogin = "openWriteModal";
      openAuthModal("login", "글쓰기는 로그인 후 이용하실 수 있습니다 🥔");
      return;
    }

    resetWriteForm();

    // 사용자의 기본 활동 동네가 있으면 거래 동네 인풋에 자동 입력
    if (state.currentProfile && state.currentProfile.activity_location) {
      const locInput = document.getElementById("writeLocation");
      if (locInput && !locInput.value) {
        locInput.value = state.currentProfile.activity_location;
      }
    }

    const modal = document.getElementById("writeModalBackdrop");
    if (modal) {
      modal.classList.add("active");
      document.body.classList.add("modal-open");
    }
  }

  function closeWriteModal() {
    const modal = document.getElementById("writeModalBackdrop");
    if (modal) {
      modal.classList.remove("active");
    }
    document.body.classList.remove("modal-open");
  }

  function resetWriteForm() {
    state.editingProductId = null;
    const heading = document.getElementById("writeModalHeading");
    if (heading) heading.textContent = "따뜻한 감자마을에 글쓰기 🥔";
    const submitBtn = document.querySelector("#gamzaWriteForm button[type='submit']");
    if (submitBtn) submitBtn.textContent = "작성 완료";

    const form = document.getElementById("gamzaWriteForm");
    if (form) form.reset();
    state.writeImageData = "";
    updateImagePreview("");
    // 판매상태 라디오 기본값 '판매중'
    const defaultRadio = document.querySelector('input[name="writeStatus"][value="판매중"]');
    if (defaultRadio) {
      defaultRadio.checked = true;
      updateStatusRadioLabels();
    }
  }

  function updateImagePreview(src) {
    const previewImg = document.getElementById("writeImagePreview");
    const placeholder = document.getElementById("writeImagePlaceholder");
    if (!previewImg || !placeholder) return;

    if (src) {
      previewImg.src = src;
      previewImg.style.display = "block";
      placeholder.style.display = "none";
      state.writeImageData = src;
    } else {
      previewImg.src = "";
      previewImg.style.display = "none";
      placeholder.style.display = "flex";
      state.writeImageData = "";
    }
  }

  function updateStatusRadioLabels() {
    const radios = document.querySelectorAll('input[name="writeStatus"]');
    radios.forEach(radio => {
      const label = radio.closest(".status-radio-label");
      if (label) {
        if (radio.checked) {
          label.classList.add("selected");
        } else {
          label.classList.remove("selected");
        }
      }
    });
  }

  /**
   * [요구사항] 글 등록 및 수정 제출 핸들러
   */
  async function handleWriteSubmit(e) {
    e.preventDefault();

    if (!state.currentUser) {
      state.pendingActionAfterLogin = "openWriteModal";
      openAuthModal("login", "글을 등록하려면 로그인이 필요합니다 🥔");
      return;
    }

    const title = document.getElementById("writeTitle").value.trim();
    const category = document.getElementById("writeCategory").value;
    const priceRaw = document.getElementById("writePrice").value.trim();
    const location = document.getElementById("writeLocation").value.trim();
    const description = document.getElementById("writeDescription").value.trim();
    const statusRadio = document.querySelector('input[name="writeStatus"]:checked');
    const status = statusRadio ? statusRadio.value : "판매중";

    // 유효성 검사
    if (!title) {
      alert("상품명을 입력해주세요!");
      document.getElementById("writeTitle").focus();
      return;
    }
    if (!category) {
      alert("카테고리를 선택해주세요!");
      document.getElementById("writeCategory").focus();
      return;
    }
    if (priceRaw === "") {
      alert("가격을 입력해주세요! (무료 나눔은 0을 입력하세요)");
      document.getElementById("writePrice").focus();
      return;
    }
    if (!location) {
      alert("거래 동네를 입력해주세요! (예: 역삼동, 효자동)");
      document.getElementById("writeLocation").focus();
      return;
    }
    if (!description) {
      alert("자세한 설명을 입력해주세요!");
      document.getElementById("writeDescription").focus();
      return;
    }

    const price = parseInt(priceRaw, 10) || 0;
    const finalImage = state.writeImageData || SAMPLE_IMAGES[0].url;

    const submitBtn = document.querySelector("#gamzaWriteForm button[type='submit']");
    const isEditing = Boolean(state.editingProductId);

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = isEditing ? "수정 반영 중... 🥔" : "감자 등록 중... 🥔";
    }

    try {
      // 1) [수정 모드] 기존 게시글 업데이트
      if (isEditing) {
        const updatePayload = {
          title,
          category,
          price,
          location,
          status,
          image_url: finalImage,
          description,
          updated_at: new Date().toISOString()
        };

        if (supabase) {
          const { error } = await supabase
            .from('products')
            .update(updatePayload)
            .eq('id', state.editingProductId);

          if (error) throw error;
        } else {
          const target = state.products.find(p => String(p.id) === String(state.editingProductId));
          if (target) {
            Object.assign(target, {
              title,
              category,
              price,
              location,
              status,
              image: finalImage,
              description
            });
          }
        }

        const editedId = state.editingProductId;
        state.editingProductId = null;
        closeWriteModal();

        await fetchProductsFromSupabase();
        showToast("🎉 게시글이 성공적으로 수정되었습니다!");

        // 수정 완료 후 수정된 게시글 상세 팝업 다시 열기
        setTimeout(() => {
          openDetailModal(editedId);
        }, 150);
        return;
      }

      // 2) [신규 등록 모드] 작성자 ID를 현재 로그인된 사용자의 ID로 지정
      const sellerId = state.currentUser.id;

      if (supabase) {
        // profiles 레코드 존재 여부 한 번 더 보장
        await ensureUserProfile(state.currentUser);

        // Supabase DB에 신규 상품 저장 (seller_id = 현재 로그인 사용자 ID)
        const { error } = await supabase
          .from('products')
          .insert([
            {
              seller_id: sellerId,
              title,
              category,
              price,
              location,
              status,
              image_url: finalImage,
              description
            }
          ]);

        if (error) throw error;
      } else {
        // 오프라인 fallback
        const sellerNick = state.currentProfile ? state.currentProfile.nickname : "동네감자 (나)";
        const newProduct = {
          id: 'local-' + Date.now(),
          sellerId: sellerId,
          title,
          category,
          price,
          location,
          uploadTime: "방금 전",
          status,
          image: finalImage,
          description,
          isWished: false,
          seller: {
            id: sellerId,
            nickname: sellerNick,
            avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
            location: location,
            mannerTemp: 36.5,
            certCount: 1
          }
        };
        state.products.unshift(newProduct);
      }

      // 모달 닫기 및 폼 초기화
      closeWriteModal();

      // 전체 카테고리로 전환하여 등록된 새 상품이 바로 보이도록 갱신
      state.selectedCategory = "전체";
      document.querySelectorAll(".category-chip").forEach(chip => {
        chip.classList.toggle("active", chip.getAttribute("data-category") === "전체");
      });

      // DB 최신 데이터 새로고침
      await fetchProductsFromSupabase();

      showToast("🎉 새로운 감자 상품이 등록되었습니다!");
      window.scrollTo({ top: 0, behavior: "smooth" });

    } catch (err) {
      console.error(isEditing ? "상품 수정 실패:" : "상품 등록 실패:", err);
      alert((isEditing ? "상품 수정 중 오류가 발생했습니다: " : "상품 등록 중 오류가 발생했습니다: ") + (err.message || err));
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = isEditing ? "수정 완료" : "작성 완료";
      }
    }
  }

  // ==========================================================================
  // 이벤트 바인딩 및 초기화
  // ==========================================================================
  function initEvents() {
    // 1. 카테고리 칩 클릭
    document.querySelectorAll(".category-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        document.querySelectorAll(".category-chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        state.selectedCategory = chip.getAttribute("data-category") || "전체";
        renderProductList();
      });
    });

    // 2. '거래 가능만 보기' 토글 스위치
    const toggleAvailable = document.getElementById("gamza-toggle-available");
    if (toggleAvailable) {
      toggleAvailable.addEventListener("change", (e) => {
        state.onlyAvailable = e.target.checked;
        renderProductList();
      });
    }

    // 3. 검색창 실시간 입력
    const searchInput = document.getElementById("gamza-search-input");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        state.searchKeyword = e.target.value;
        renderProductList();
      });
    }

    // 4. [글쓰기] 버튼 클릭: 비로그인 시 로그인 모달 먼저 오픈
    const btnOpenWrite = document.getElementById("gamza-btn-write");
    if (btnOpenWrite) {
      btnOpenWrite.addEventListener("click", openWriteModal);
    }

    // 5. [로그인] 버튼 클릭: 로그인 모달 열기
    const btnLogin = document.getElementById("gamza-btn-login");
    if (btnLogin) {
      btnLogin.addEventListener("click", () => {
        openAuthModal("login");
      });
    }

    // 6. [로그아웃] 버튼 클릭
    const btnLogout = document.getElementById("gamza-btn-logout");
    if (btnLogout) {
      btnLogout.addEventListener("click", handleLogout);
    }

    // 7. [인증 모달] 탭 전환 및 닫기 이벤트
    const authCloseBtn = document.getElementById("authModalCloseBtn");
    if (authCloseBtn) authCloseBtn.addEventListener("click", closeAuthModal);

    const authBackdrop = document.getElementById("authModalBackdrop");
    if (authBackdrop) {
      authBackdrop.addEventListener("click", (e) => {
        if (e.target === authBackdrop) closeAuthModal();
      });
    }

    const authTabLogin = document.getElementById("authTabLogin");
    if (authTabLogin) {
      authTabLogin.addEventListener("click", () => switchAuthTab("login"));
    }

    const authTabSignup = document.getElementById("authTabSignup");
    if (authTabSignup) {
      authTabSignup.addEventListener("click", () => switchAuthTab("signup"));
    }

    const linkToSignup = document.getElementById("linkToSignup");
    if (linkToSignup) {
      linkToSignup.addEventListener("click", () => switchAuthTab("signup"));
    }

    const linkToLogin = document.getElementById("linkToLogin");
    if (linkToLogin) {
      linkToLogin.addEventListener("click", () => switchAuthTab("login"));
    }

    // 로그인 & 회원가입 폼 전송 이벤트
    const loginForm = document.getElementById("gamzaLoginForm");
    if (loginForm) loginForm.addEventListener("submit", handleLoginSubmit);

    const signupForm = document.getElementById("gamzaSignupForm");
    if (signupForm) signupForm.addEventListener("submit", handleSignupSubmit);

    // 8. [상세 모달] 닫기 및 이벤트
    const detailCloseBtn = document.getElementById("detailModalCloseBtn");
    if (detailCloseBtn) detailCloseBtn.addEventListener("click", closeDetailModal);

    const detailBackdrop = document.getElementById("detailModalBackdrop");
    if (detailBackdrop) {
      detailBackdrop.addEventListener("click", (e) => {
        if (e.target === detailBackdrop) closeDetailModal();
      });
    }

    const detailWishBtn = document.getElementById("detailWishBtn");
    if (detailWishBtn) detailWishBtn.addEventListener("click", toggleWish);

    const detailChatBtn = document.getElementById("detailChatBtn");
    if (detailChatBtn) {
      detailChatBtn.addEventListener("click", () => {
        showToast("🥔 감자톡 채팅 기능은 다음 단계에서 만나요!");
      });
    }

    // [작성자 전용] 거래 상태 선택 버튼 클릭 이벤트
    document.querySelectorAll(".btn-status-toggle").forEach(btn => {
      btn.addEventListener("click", () => {
        const newStatus = btn.getAttribute("data-status");
        if (newStatus) handleDetailStatusChange(newStatus);
      });
    });

    // [작성자 전용] 게시글 수정 및 삭제 버튼 이벤트
    const detailEditBtn = document.getElementById("detailEditBtn");
    if (detailEditBtn) {
      detailEditBtn.addEventListener("click", handleStartEdit);
    }

    const detailDeleteBtn = document.getElementById("detailDeleteBtn");
    if (detailDeleteBtn) {
      detailDeleteBtn.addEventListener("click", handleDeleteProduct);
    }

    // 9. [글쓰기 모달] 닫기 및 폼 이벤트
    const writeCloseBtn = document.getElementById("writeModalCloseBtn");
    if (writeCloseBtn) writeCloseBtn.addEventListener("click", closeWriteModal);

    const writeBackdrop = document.getElementById("writeModalBackdrop");
    if (writeBackdrop) {
      writeBackdrop.addEventListener("click", (e) => {
        if (e.target === writeBackdrop) closeWriteModal();
      });
    }

    const writeForm = document.getElementById("gamzaWriteForm");
    if (writeForm) writeForm.addEventListener("submit", handleWriteSubmit);

    // 판매상태 라디오 체인지
    document.querySelectorAll('input[name="writeStatus"]').forEach(radio => {
      radio.addEventListener("change", updateStatusRadioLabels);
    });

    // 파일 업로드 실시간 미리보기
    const fileInput = document.getElementById("writeFileUpload");
    if (fileInput) {
      fileInput.addEventListener("change", (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            updateImagePreview(event.target.result);
          };
          reader.readAsDataURL(file);
        }
      });
    }

    // 이미지 URL 직접 입력
    const urlInput = document.getElementById("writeImageUrlInput");
    const applyUrlBtn = document.getElementById("btnApplyImageUrl");
    if (applyUrlBtn && urlInput) {
      applyUrlBtn.addEventListener("click", () => {
        const url = urlInput.value.trim();
        if (url) {
          updateImagePreview(url);
          showToast("이미지 URL이 적용되었습니다.");
        }
      });
    }

    // 샘플 이미지 칩 클릭
    const sampleChipsContainer = document.getElementById("sampleImageChips");
    if (sampleChipsContainer) {
      sampleChipsContainer.innerHTML = SAMPLE_IMAGES.map((sample) => `
        <button type="button" class="sample-chip-btn" data-url="${sample.url}">
          ${sample.name}
        </button>
      `).join("");

      sampleChipsContainer.querySelectorAll(".sample-chip-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const url = btn.getAttribute("data-url");
          updateImagePreview(url);
          if (urlInput) urlInput.value = url;
          showToast(`'${btn.textContent.trim()}' 이미지가 선택되었습니다.`);
        });
      });
    }

    // 10. ESC 키 전역 닫기 지원
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" || e.key === "Esc") {
        closeDetailModal();
        closeWriteModal();
        closeAuthModal();
      }
    });

    // 11. Auth 세션 확인 및 초기 상품 로드
    initAuth().then(() => {
      fetchProductsFromSupabase();
    });
  }

  // DOM 로드 완료 후 실행
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initEvents);
  } else {
    initEvents();
  }

  // 외부 참조가 필요할 경우를 위한 전역 객체
  window.GamzaApp = {
    state,
    fetchProductsFromSupabase,
    renderProductList,
    openDetailModal,
    closeDetailModal,
    openWriteModal,
    closeWriteModal,
    openAuthModal,
    closeAuthModal,
    handleLogout
  };
})();
