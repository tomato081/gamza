/**
 * 감자(Gamza) 중고 거래 서비스 - [화면 2] 상품 상세 팝업 (모달) 스크립트
 * 모달 열기/닫기, ESC 키 제어, 뒷배경 클릭 닫기, 하트 토글, 데이터 바인딩
 */

(function (global) {
  'use strict';

  // 상태 관리
  let currentProduct = null;
  let isClosing = false;

  // DOM 요소 캐시
  const elements = {
    overlay: null,
    window: null,
    closeBtn: null,
    scrollArea: null,
    // 상품 필드
    productImage: null,
    statusBadge: null,
    categoryTag: null,
    productTitle: null,
    locationText: null,
    timeText: null,
    priceVal: null,
    negotiableBadge: null,
    descriptionText: null,
    // 판매자 필드
    sellerAvatar: null,
    sellerNickname: null,
    sellerLocation: null,
    sellerCerts: null,
    sellerManner: null,
    // 하단 액션바
    wishBtn: null,
    wishCount: null,
    bottomPrice: null,
    chatBtn: null
  };

  /**
   * DOM 요소 초기화 및 이벤트 리스너 등록
   */
  function initElements() {
    elements.overlay = document.getElementById('gamza-detail-modal-overlay');
    if (!elements.overlay) return false;

    elements.window = elements.overlay.querySelector('.gamza-modal-window');
    elements.closeBtn = document.getElementById('modal-close-btn');
    elements.scrollArea = document.getElementById('modal-scroll-area');

    elements.productImage = document.getElementById('modal-product-image');
    elements.statusBadge = document.getElementById('modal-status-badge');
    elements.categoryTag = document.getElementById('modal-category-tag');
    elements.productTitle = document.getElementById('modal-product-title');
    elements.locationText = document.getElementById('modal-location-text');
    elements.timeText = document.getElementById('modal-time-text');
    elements.priceVal = document.getElementById('modal-price-val');
    elements.negotiableBadge = document.getElementById('modal-negotiable-badge');
    elements.descriptionText = document.getElementById('modal-description-text');

    elements.sellerAvatar = document.getElementById('modal-seller-avatar');
    elements.sellerNickname = document.getElementById('modal-seller-nickname');
    elements.sellerLocation = document.getElementById('modal-seller-location');
    elements.sellerCerts = document.getElementById('modal-seller-certs');
    elements.sellerManner = document.getElementById('modal-seller-manner');

    elements.wishBtn = document.getElementById('modal-wish-btn');
    elements.wishCount = document.getElementById('modal-wish-count');
    elements.bottomPrice = document.getElementById('modal-bottom-price');
    elements.chatBtn = document.getElementById('modal-chat-btn');

    bindEvents();
    return true;
  }

  /**
   * 이벤트 바인딩
   */
  function bindEvents() {
    // 1. 닫기 버튼 [✕]
    if (elements.closeBtn) {
      elements.closeBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        closeDetailModal();
      });
    }

    // 2. 딤드 오버레이 클릭 시 닫기 (윈도우 내부 클릭 제외)
    if (elements.overlay) {
      elements.overlay.addEventListener('click', function (e) {
        if (e.target === elements.overlay) {
          closeDetailModal();
        }
      });
    }

    // 3. ESC 키 누를 시 닫기 지원
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' || e.key === 'Esc') {
        if (elements.overlay && !elements.overlay.classList.contains('hidden')) {
          closeDetailModal();
        }
      }
    });

    // 4. [관심 추가] 하트 아이콘 버튼 토글 (반응 효과 및 카운트 반영)
    if (elements.wishBtn) {
      elements.wishBtn.addEventListener('click', function (e) {
        e.preventDefault();
        toggleWish();
      });
    }

    // 5. [채팅 시작하기] 주황/브라운 포인트 버튼 (자리 유지 & 이벤트 디스패치)
    if (elements.chatBtn) {
      elements.chatBtn.addEventListener('click', function (e) {
        e.preventDefault();
        if (!currentProduct) return;
        // 커스텀 이벤트 전달
        const chatEvent = new CustomEvent('gamza:startChat', {
          detail: { product: currentProduct }
        });
        window.dispatchEvent(chatEvent);
        console.log(`[Gamza] 채팅 시작 요청: 상품 ID [${currentProduct.id}] - ${currentProduct.title}`);
      });
    }
  }

  /**
   * 금액 세자리 콤마 포맷터 (예: 18000 -> 18,000원)
   */
  function formatKoreanPrice(price) {
    if (price === 0 || price === '0') return '나눔 🧡';
    const num = typeof price === 'number' ? price : parseInt(price, 10);
    if (isNaN(num)) return '가격 미정';
    return `${num.toLocaleString('ko-KR')}원`;
  }

  /**
   * 판매 상태 배지 텍스트 및 클래스 매핑
   * status: 'selling' | 'reserved' | 'completed' | '판매중' | '예약중' | '거래완료'
   */
  function applyStatusBadge(status) {
    const badgeEl = elements.statusBadge;
    if (!badgeEl) return;

    badgeEl.classList.remove('status-selling', 'status-reserved', 'status-completed');

    let text = '판매중';
    let className = 'status-selling';

    if (status === 'reserved' || status === '예약중') {
      text = '예약중';
      className = 'status-reserved';
    } else if (status === 'completed' || status === '거래완료' || status === '거래 완료') {
      text = '거래완료';
      className = 'status-completed';
    } else {
      text = '판매중';
      className = 'status-selling';
    }

    badgeEl.textContent = text;
    badgeEl.classList.add(className);
  }

  /**
   * 관심(찜) 토글 동작
   */
  function toggleWish() {
    if (!currentProduct || !elements.wishBtn) return;

    currentProduct.isWished = !currentProduct.isWished;
    if (currentProduct.isWished) {
      currentProduct.wishCount = (currentProduct.wishCount || 0) + 1;
      elements.wishBtn.classList.add('wished');
      elements.wishBtn.setAttribute('aria-pressed', 'true');
    } else {
      currentProduct.wishCount = Math.max(0, (currentProduct.wishCount || 1) - 1);
      elements.wishBtn.classList.remove('wished');
      elements.wishBtn.setAttribute('aria-pressed', 'false');
    }

    if (elements.wishCount) {
      elements.wishCount.textContent = currentProduct.wishCount;
    }

    // 커스텀 이벤트 통지
    const wishEvent = new CustomEvent('gamza:wishChange', {
      detail: {
        productId: currentProduct.id,
        isWished: currentProduct.isWished,
        wishCount: currentProduct.wishCount
      }
    });
    window.dispatchEvent(wishEvent);
  }

  /**
   * 상품 상세 데이터 모달에 바인딩
   */
  function bindProductData(product) {
    currentProduct = { ...product };

    // 1) 상품 대표 이미지
    if (elements.productImage) {
      elements.productImage.src = product.image || 'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22600%22%20height%3D%22400%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20600%20400%22%3E%3Crect%20fill%3D%22%23E8DFD3%22%20width%3D%22600%22%20height%3D%22400%22%2F%3E%3Ctext%20fill%3D%22%23945214%22%20font-family%3D%22sans-serif%22%20font-size%3D%2224%22%20font-weight%3D%22bold%22%20x%3D%2250%25%22%20y%3D%2250%25%22%20text-anchor%3D%22middle%22%20dy%3D%22.3em%22%3E%EA%B0%90%EC%9E%90%20%EC%83%81%ED%92%88%20%EC%9D%B4%EB%AF%B8%EC%A7%80%20%EB%A1%9C%EB%94%A9%20%EC%A4%91...%3C%2Ftext%3E%3C%2Fsvg%3E';
      elements.productImage.alt = product.title || '감자 상품';
    }

    // 2) 판매 상태 배지 + 카테고리 태그
    applyStatusBadge(product.status);
    if (elements.categoryTag) {
      elements.categoryTag.textContent = product.category || '기타 중고물품';
    }

    // 3) 상품명
    if (elements.productTitle) {
      elements.productTitle.textContent = product.title || '제목 없음';
    }

    // 4) 위치 및 시간 (메타 정보)
    if (elements.locationText) {
      elements.locationText.textContent = product.location || '전국';
    }
    if (elements.timeText) {
      elements.timeText.textContent = product.timeAgo || product.createdAt || '방금 전';
    }

    // 5) 가격
    const formattedPrice = formatKoreanPrice(product.price);
    if (elements.priceVal) {
      elements.priceVal.textContent = formattedPrice;
    }
    if (elements.bottomPrice) {
      elements.bottomPrice.textContent = formattedPrice;
    }

    // 가격 제안 여부
    if (elements.negotiableBadge) {
      if (product.negotiable === true) {
        elements.negotiableBadge.textContent = '가격 제안 가능';
        elements.negotiableBadge.classList.remove('non-negotiable');
      } else {
        elements.negotiableBadge.textContent = '가격 제안 불가';
        elements.negotiableBadge.classList.add('non-negotiable');
      }
    }

    // 6) 상품 설명 (줄바꿈 유지)
    if (elements.descriptionText) {
      elements.descriptionText.textContent = product.description || '등록된 상세 설명이 없습니다.';
    }

    // 7) 판매자 정보
    const seller = product.seller || {};
    if (elements.sellerAvatar) {
      elements.sellerAvatar.src = seller.avatar || 'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22100%22%20height%3D%22100%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2250%22%20r%3D%2250%22%20fill%3D%22%23B36B22%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2255%25%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-size%3D%2236%22%20dy%3D%22.1em%22%3E%F0%9F%A5%94%3C%2Ftext%3E%3C%2Fsvg%3E';
      elements.sellerAvatar.alt = (seller.nickname || '판매자') + ' 아바타';
    }
    if (elements.sellerNickname) {
      elements.sellerNickname.textContent = seller.nickname || '익명의 감자';
    }
    if (elements.sellerLocation) {
      elements.sellerLocation.textContent = seller.location || product.location || '동네 인증 완료';
    }
    if (elements.sellerCerts) {
      elements.sellerCerts.textContent = `인증 ${seller.certCount != null ? seller.certCount : 1}회`;
    }
    if (elements.sellerManner) {
      const temp = seller.mannerTemp != null ? seller.mannerTemp : 36.5;
      elements.sellerManner.textContent = `${temp.toFixed(1)}°C`;
    }

    // 8) 관심 상태 및 카운트
    if (elements.wishBtn) {
      if (product.isWished) {
        elements.wishBtn.classList.add('wished');
        elements.wishBtn.setAttribute('aria-pressed', 'true');
      } else {
        elements.wishBtn.classList.remove('wished');
        elements.wishBtn.setAttribute('aria-pressed', 'false');
      }
    }
    if (elements.wishCount) {
      elements.wishCount.textContent = product.wishCount || 0;
    }

    // 스크롤 상단 리셋
    if (elements.scrollArea) {
      elements.scrollArea.scrollTop = 0;
    }
  }

  /**
   * 모달 열기 함수 (외부 공개)
   * @param {Object} product - 상품 상세 데이터 객체
   */
  function openDetailModal(product) {
    if (!elements.overlay) {
      if (!initElements()) {
        console.error('[Gamza] 모달 요소를 찾을 수 없습니다.');
        return;
      }
    }

    if (!product) {
      console.warn('[Gamza] 상품 데이터가 전달되지 않았습니다.');
      return;
    }

    // 데이터 바인딩
    bindProductData(product);

    // 모달 표시 & 페이드인 / 스케일업 애니메이션
    elements.overlay.classList.remove('hidden', 'closing');
    elements.overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');

    // 닫기 버튼으로 포커스 이동 (접근성)
    setTimeout(() => {
      if (elements.closeBtn) {
        elements.closeBtn.focus();
      }
    }, 50);

    // 열림 커스텀 이벤트
    const openEvent = new CustomEvent('gamza:modalOpen', {
      detail: { product: currentProduct }
    });
    window.dispatchEvent(openEvent);
  }

  /**
   * 모달 닫기 함수 (외부 공개)
   */
  function closeDetailModal() {
    if (!elements.overlay || elements.overlay.classList.contains('hidden') || isClosing) {
      return;
    }

    isClosing = true;
    elements.overlay.classList.add('closing');

    // 애니메이션 후 완전히 숨김
    setTimeout(() => {
      elements.overlay.classList.add('hidden');
      elements.overlay.classList.remove('closing');
      elements.overlay.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('modal-open');
      isClosing = false;

      // 닫힘 커스텀 이벤트
      const closeEvent = new CustomEvent('gamza:modalClose', {
        detail: { product: currentProduct }
      });
      window.dispatchEvent(closeEvent);
    }, 280);
  }

  // DOMContentLoaded 시 자동 초기화 준비
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initElements);
  } else {
    initElements();
  }

  // 외부 전역 노출
  global.GamzaDetailModal = {
    open: openDetailModal,
    close: closeDetailModal,
    init: initElements
  };

  global.openDetailModal = openDetailModal;
  global.closeDetailModal = closeDetailModal;

})(window);
