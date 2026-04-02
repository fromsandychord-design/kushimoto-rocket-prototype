/* ============================================
   SPACEPORT KII PORTAL — Main JavaScript
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  /* --- Page Loader --- */
  const loader = document.querySelector('.page-loader');
  if (loader) {
    window.addEventListener('load', () => {
      setTimeout(() => {
        loader.classList.add('fade-out');
        setTimeout(() => loader.remove(), 500);
      }, 600);
    });
  }

  /* --- Navigation Scroll Effect --- */
  const nav = document.querySelector('.nav-header');
  if (nav) {
    const handleScroll = () => {
      if (window.scrollY > 60) {
        nav.classList.add('scrolled');
      } else {
        nav.classList.remove('scrolled');
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
  }

  /* --- Mobile Menu --- */
  const mobileBtn = document.querySelector('.mobile-menu-btn');
  const mobileMenu = document.querySelector('.mobile-menu');
  if (mobileBtn && mobileMenu) {
    mobileBtn.addEventListener('click', () => {
      mobileBtn.classList.toggle('active');
      mobileMenu.classList.toggle('active');
      document.body.style.overflow = mobileMenu.classList.contains('active') ? 'hidden' : '';
    });
    mobileMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mobileBtn.classList.remove('active');
        mobileMenu.classList.remove('active');
        document.body.style.overflow = '';
      });
    });
  }

  /* --- GSAP ScrollTrigger Animations --- */
  if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);

    // Reveal animations
    const reveals = document.querySelectorAll('.reveal');
    reveals.forEach((el, i) => {
      gsap.fromTo(el,
        { opacity: 0, y: 40 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 85%',
            toggleActions: 'play none none none'
          }
        }
      );
    });

    // Stagger card animations
    const cardGroups = document.querySelectorAll('.card-stagger');
    cardGroups.forEach(group => {
      const cards = group.children;
      gsap.fromTo(cards,
        { opacity: 0, y: 50 },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          stagger: 0.1,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: group,
            start: 'top 80%',
            toggleActions: 'play none none none'
          }
        }
      );
    });

    // Parallax for hero images
    const heroBgs = document.querySelectorAll('.hero-bg');
    heroBgs.forEach(bg => {
      gsap.to(bg, {
        y: '20%',
        ease: 'none',
        scrollTrigger: {
          trigger: bg.parentElement,
          start: 'top top',
          end: 'bottom top',
          scrub: true
        }
      });
    });
  }

  /* --- Chatbot Widget --- */
  const chatToggle = document.querySelector('.chatbot-toggle');
  const chatPanel = document.querySelector('.chatbot-panel');
  if (chatToggle && chatPanel) {
    chatToggle.addEventListener('click', () => {
      chatPanel.classList.toggle('active');
      chatToggle.textContent = chatPanel.classList.contains('active') ? '✕' : '🚀';
    });
  }

  // Language switcher in chatbot
  const langBtns = document.querySelectorAll('.lang-btn');
  langBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      langBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  /* --- Reservation Modal --- */
  const modalOverlay = document.querySelector('.modal-overlay');
  const modalForm = document.querySelector('.modal-form');
  const modalSuccess = document.querySelector('.modal-success-content');

  // Open modal
  document.querySelectorAll('[data-modal="reservation"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (modalOverlay) {
        modalOverlay.classList.add('active');
        if (modalForm) modalForm.style.display = 'block';
        if (modalSuccess) modalSuccess.style.display = 'none';
        // Set tour name if available
        const tourName = btn.dataset.tour || '';
        const tourInput = document.querySelector('#modal-tour-name');
        if (tourInput) tourInput.value = tourName;
      }
    });
  });

  // Close modal
  document.querySelectorAll('[data-modal-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (modalOverlay) modalOverlay.classList.remove('active');
    });
  });

  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) modalOverlay.classList.remove('active');
    });
  }

  // Submit form (dummy)
  const reservationForm = document.querySelector('#reservation-form');
  if (reservationForm) {
    reservationForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (modalForm) modalForm.style.display = 'none';
      if (modalSuccess) modalSuccess.style.display = 'block';
    });
  }

  /* --- Map Filters --- */
  const filterBtns = document.querySelectorAll('.filter-btn');
  const spotItems = document.querySelectorAll('.spot-item');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;

      // Toggle active state
      if (filter === 'all') {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      } else {
        document.querySelector('.filter-btn[data-filter="all"]')?.classList.remove('active');
        btn.classList.toggle('active');
      }

      // Get active filters
      const activeFilters = Array.from(document.querySelectorAll('.filter-btn.active'))
        .map(b => b.dataset.filter)
        .filter(f => f !== 'all');

      // Filter spots
      spotItems.forEach(item => {
        if (activeFilters.length === 0 || activeFilters.includes(item.dataset.category)) {
          item.style.display = '';
          gsap?.fromTo(item, { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: 0.3 });
        } else {
          item.style.display = 'none';
        }
      });
    });
  });

  /* --- Scroll Chevron --- */
  const chevron = document.querySelector('.scroll-chevron');
  if (chevron) {
    chevron.addEventListener('click', () => {
      const nextSection = document.querySelector('.section');
      if (nextSection) {
        nextSection.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  /* --- Active Nav Link --- */
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a, .mobile-menu a').forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });
});
