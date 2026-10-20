/**
 * Gamza (감자) - 상품 목록 화면 JavaScript 로직
 * 
 * 주요 기능:
 * - 상품 더미 데이터 (8종 이상)
 * - 카테고리 필터링
 * - '거래 가능만 보기' 토글 스위치 필터링
 * - 검색어 실시간 필터링
 * - 상품 카드 렌더링 및 가격 포맷팅
 * - 상품 클릭 시 상세 모달 오픈 이벤트 연동
 */

// 1. 초기 더미 데이터 (동네 중고 거래 현실적인 데이터 구성)
const INITIAL_PRODUCTS = [
  {
    id: 2,
    title: "원목 4인용 식탁 세트 (의자 4개 포함, 상태 양호)",
    category: "가구/인테리어",
    price: 80000,
    status: "판매중",
    location: "대치2동",
    timeAgo: "1시간 전",
    imageUrl: "https://images.unsplash.com/photo-1615066390971-03e4e1c36ddf?w=600&auto=format&fit=crop&q=80",
    likes: 8,
    chats: 2
  },
  {
    id: 3,
    title: "파타고니아 레트로X 클래식 플리스 자켓 M 사이즈",
    category: "의류",
    price: 120000,
    status: "예약중",
    location: "삼성1동",
    timeAgo: "3시간 전",
    imageUrl: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&auto=format&fit=crop&q=80",
    likes: 19,
    chats: 6
  },
  {
    id: 4,
    title: "드롱기 전자동 커피머신 마그니피카S (정품)",
    category: "생활가전",
    price: 230000,
    status: "판매중",
    location: "청담동",
    timeAgo: "5시간 전",
    imageUrl: "https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=600&auto=format&fit=crop&q=80",
    likes: 24,
    chats: 7
  },
  {
    id: 5,
    title: "불편한 편의점 1, 2권 세트 (소설, 밑줄 없음)",
    category: "도서/티켓",
    price: 15000,
    status: "거래 완료",
    location: "논현2동",
    timeAgo: "1일 전",
    imageUrl: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80",
    likes: 5,
    chats: 3
  },
  {
    id: 6,
    title: "강원도 햇감자 보관용 우드 박스 & 미니 모종삽 세트",
    category: "기타",
    price: 12000,
    status: "판매중",
    location: "개포4동",
    timeAgo: "2일 전",
    imageUrl: "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=600&auto=format&fit=crop&q=80",
    likes: 31,
    chats: 9
  },
  {
    id: 7,
    title: "소니 WH-1000XM5 무선 노이즈 캔슬링 헤드폰 실버",
    category: "디지털기기",
    price: 310000,
    status: "판매중",
    location: "신사동",
    timeAgo: "2일 전",
    imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80",
    likes: 15,
    chats: 5
  },
  {
    id: 8,
    title: "감성 캠핑 우드 롤테이블 120 (가방 포함)",
    category: "가구/인테리어",
    price: 45000,
    status: "거래 완료",
    location: "역삼2동",
    timeAgo: "3일 전",
    imageUrl: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600&auto=format&fit=crop&q=80",
    likes: 9,
    chats: 4
  }
];

// 2. 상태 관리 객체 (State)
const state = {
  products: [...INITIAL_PRODUCTS],
  selectedCategory: "전체",
  onlyAvailable: false,
  searchKeyword: ""
};

// 3. 유틸리티 함수
/**
 * 숫자를 한국 원화 형식(35,000원)으로 포맷팅
 * @param {number} amount 
 * @returns {string}
 */
function formatPrice(amount) {
  if (amount === 0) return "나눔 🧡";
  return amount.toLocaleString("ko-KR") + "원";
}

/**
 * 상태 텍스트에 대응하는 배지 CSS 클래스 반환
 * @param {string} status 
 * @returns {string}
 */
function getBadgeClass(status) {
  switch (status) {
    case "판매중":
      return "status-sale";
    case "예약중":
      return "status-reserved";
    case "거래 완료":
      return "status-completed";
    default:
      return "status-sale";
  }
}

// 4. 상품 카드 렌더링 함수
function renderProductList() {
  const gridContainer = document.getElementById("gamza-product-grid");
  const countEl = document.getElementById("gamza-result-count-num");
  if (!gridContainer) return;

  // 필터링 적용
  const filteredProducts = state.products.filter(product => {
    // 카테고리 필터
    const matchCategory = state.selectedCategory === "전체" || product.category === state.selectedCategory;
    
    // 거래 가능만 보기 필터 (거래 완료 제외)
    const matchAvailable = !state.onlyAvailable || product.status !== "거래 완료";
    
    // 검색어 필터 (제목, 위치, 카테고리 검색)
    const keyword = state.searchKeyword.trim().toLowerCase();
    const matchKeyword = !keyword || 
      product.title.toLowerCase().includes(keyword) || 
      product.location.toLowerCase().includes(keyword) ||
      product.category.toLowerCase().includes(keyword);

    return matchCategory && matchAvailable && matchKeyword;
  });

  // 개수 갱신
  if (countEl) {
    countEl.textContent = filteredProducts.length;
  }

  // 검색 결과가 없는 경우 빈 상태 표시
  if (filteredProducts.length === 0) {
    gridContainer.innerHTML = `
      <div class="gamza-empty-state">
        <div class="gamza-empty-icon">🥔</div>
        <h3 class="gamza-empty-title">찾으시는 물품이 없어요</h3>
        <p class="gamza-empty-desc">다른 검색어를 입력하시거나 카테고리/거래 상태 필터를 변경해보세요.</p>
        <button type="button" class="gamza-btn-reset-filter" id="gamza-btn-reset">
          필터 초기화
        </button>
      </div>
    `;

    const resetBtn = document.getElementById("gamza-btn-reset");
    if (resetBtn) {
      resetBtn.addEventListener("click", resetFilters);
    }
    return;
  }

  // 카드 HTML 생성
  gridContainer.innerHTML = filteredProducts.map(product => {
    const badgeClass = getBadgeClass(product.status);
    return `
      <article class="gamza-product-card" data-id="${product.id}" data-status="${product.status}">
        <div class="gamza-card-thumb-wrapper">
          <img class="gamza-card-thumb" src="${product.imageUrl}" alt="${escapeHtml(product.title)}" loading="lazy" />
          <span class="gamza-badge ${badgeClass}">${product.status}</span>
          <div class="gamza-card-overlay-completed"></div>
        </div>
        <div class="gamza-card-body">
          <span class="gamza-card-category">${product.category}</span>
          <h4 class="gamza-card-title">${escapeHtml(product.title)}</h4>
          <div class="gamza-card-meta">
            <span>${product.location}</span>
            <span>•</span>
            <time>${product.timeAgo}</time>
          </div>
          <div class="gamza-card-price-row">
            <span class="gamza-card-price">${formatPrice(product.price)}</span>
            <div class="gamza-card-interest">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
              <span>${product.likes}</span>
            </div>
          </div>
        </div>
      </article>
    `;
  }).join("");

  // 각 카드에 클릭 이벤트 리스너 바인딩 (상세 모달 연동)
  const cards = gridContainer.querySelectorAll(".gamza-product-card");
  cards.forEach(card => {
    card.addEventListener("click", () => {
      const productId = parseInt(card.getAttribute("data-id"), 10);
      handleProductCardClick(productId);
    });
  });
}

/**
 * XSS 방지를 위한 HTML 이스케이프 유틸
 */
function escapeHtml(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

// 5. 카드 클릭 및 모달 오픈 이벤트 핸들러
function handleProductCardClick(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;

  // 1) 커스텀 브라우저 이벤트 디스패치 (다른 화면 모듈/상세 모달 담당자가 수신 가능)
  const event = new CustomEvent("gamza:openProductDetail", {
    detail: { productId, product },
    bubbles: true
  });
  window.dispatchEvent(event);

  // 2) 글로벌 함수가 등록되어 있는 경우 직접 호출 (호환성 제공)
  if (typeof window.openProductDetailModal === "function") {
    window.openProductDetailModal(product);
  } else {
    // 모달 모듈이 아직 로드되지 않은 경우 콘솔 알림 및 기본 안내
    console.log(`[감자 상품 상세 모달 요청] ID: ${product.id}, 상품명: ${product.title}`);
  }
}

// 6. 필터 초기화
function resetFilters() {
  state.selectedCategory = "전체";
  state.onlyAvailable = false;
  state.searchKeyword = "";

  // UI 요소 리셋
  const searchInput = document.getElementById("gamza-search-input");
  if (searchInput) searchInput.value = "";

  const toggle = document.getElementById("gamza-toggle-available");
  if (toggle) toggle.checked = false;

  const categoryChips = document.querySelectorAll(".gamza-category-chip");
  categoryChips.forEach(chip => {
    if (chip.getAttribute("data-category") === "전체") {
      chip.classList.add("active");
    } else {
      chip.classList.remove("active");
    }
  });

  renderProductList();
}

// 7. 이벤트 리스너 등록
function initGamzaProductList() {
  // 카테고리 칩 클릭
  const categoryChips = document.querySelectorAll(".gamza-category-chip");
  categoryChips.forEach(chip => {
    chip.addEventListener("click", () => {
      categoryChips.forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      state.selectedCategory = chip.getAttribute("data-category") || "전체";
      renderProductList();
    });
  });

  // '거래 가능만 보기' 토글 스위치 체인지
  const toggleAvailable = document.getElementById("gamza-toggle-available");
  if (toggleAvailable) {
    toggleAvailable.addEventListener("change", (e) => {
      state.onlyAvailable = e.target.checked;
      renderProductList();
    });
  }

  // 검색창 입력 이벤트 (디바운스 처리 효과)
  const searchInput = document.getElementById("gamza-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      state.searchKeyword = e.target.value;
      renderProductList();
    });

    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        state.searchKeyword = searchInput.value;
        renderProductList();
      }
    });
  }

  // 글쓰기 버튼 클릭 이벤트
  const btnWrite = document.getElementById("gamza-btn-write");
  if (btnWrite) {
    btnWrite.addEventListener("click", () => {
      const event = new CustomEvent("gamza:openProductWrite", { bubbles: true });
      window.dispatchEvent(event);
      if (typeof window.openProductWriteModal === "function") {
        window.openProductWriteModal();
      } else {
        alert("🥔 [글쓰기] 화면 연결 준비 중입니다!");
      }
    });
  }

  // 로그인 버튼 클릭 이벤트
  const btnLogin = document.getElementById("gamza-btn-login");
  if (btnLogin) {
    btnLogin.addEventListener("click", () => {
      alert("🥔 [로그인] 기능이 준비 중입니다.");
    });
  }

  // 초기 렌더링 실행
  renderProductList();
}

// DOM 준비 시 자동 초기화
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initGamzaProductList);
} else {
  initGamzaProductList();
}

// 외부 모듈에서 활용할 수 있도록 전역 네임스페이스 등록
window.GamzaProductList = {
  state,
  renderProductList,
  resetFilters,
  addProduct: function(newProduct) {
    state.products.unshift({
      id: Date.now(),
      likes: 0,
      chats: 0,
      timeAgo: "방금 전",
      status: "판매중",
      ...newProduct
    });
    renderProductList();
  }
};
