document.addEventListener('DOMContentLoaded', function() {
    // Configuración del carrusel
    const CARDS_TO_SHOW = 5; // Número de tarjetas visibles
    const SCROLL_AMOUNT = 1; // Número de tarjetas a desplazar por click
    
    // Función para inicializar el carrusel en una sección específica
    function initializeCarousel(sectionSelector) {
        const section = document.querySelector(sectionSelector);
        if (!section) return;
        
        const box = section.querySelector('.box');
        if (!box) return;
        
        const cards = box.querySelectorAll('.minibox');
        if (cards.length === 0) return;
        
        // Solo crear carrusel si hay más tarjetas de las que caben
        if (cards.length <= CARDS_TO_SHOW) {
            return; // No necesita carrusel
        }
        
        // Crear contenedor del carrusel
        const carouselContainer = document.createElement('div');
        carouselContainer.className = 'carousel-container';
        
        // Crear flechas de navegación
        const leftArrow = document.createElement('button');
        leftArrow.className = 'carousel-arrow left';
        leftArrow.innerHTML = '‹';
        leftArrow.setAttribute('aria-label', 'Anterior');
        
        const rightArrow = document.createElement('button');
        rightArrow.className = 'carousel-arrow right';
        rightArrow.innerHTML = '›';
        rightArrow.setAttribute('aria-label', 'Siguiente');
        
        // Mover el box dentro del contenedor del carrusel
        box.parentNode.insertBefore(carouselContainer, box);
        carouselContainer.appendChild(leftArrow);
        carouselContainer.appendChild(box);
        carouselContainer.appendChild(rightArrow);
        
        // Agregar clase has-carousel a la sección
        section.classList.add('has-carousel');
        
        // Variables de estado
        let currentIndex = 0;
        
        // Función para calcular el índice máximo basado en el espacio disponible
        function getMaxIndex() {
            // Obtener el ancho real disponible para las tarjetas
            const containerStyle = window.getComputedStyle(carouselContainer);
            const containerWidth = carouselContainer.offsetWidth;
            const paddingLeft = parseInt(containerStyle.paddingLeft) || 0;
            const paddingRight = parseInt(containerStyle.paddingRight) || 0;
            const arrowSpace = 120; // Espacio para las flechas (40px cada una + margen)
            
            const availableWidth = containerWidth - paddingLeft - paddingRight - arrowSpace;
            
            const cardWidth = cards[0].offsetWidth;
            const gap = parseInt(window.getComputedStyle(box).gap) || 16;
            const cardWithGap = cardWidth + gap;
            
            const visibleCards = Math.floor(availableWidth / cardWithGap);
            return Math.max(0, cards.length - Math.max(1, visibleCards));
        }
        
        // Función para obtener el ancho de una tarjeta incluyendo el gap
        function getCardWidth() {
            const cardWidth = cards[0].offsetWidth;
            const gap = parseInt(window.getComputedStyle(box).gap) || 16;
            return cardWidth + gap;
        }
        
        // Función para actualizar la posición del carrusel
        function updateCarousel() {
            const maxIndex = getMaxIndex();
            const cardWidth = getCardWidth();
            
            // Asegurar que currentIndex esté dentro de los límites
            currentIndex = Math.max(0, Math.min(currentIndex, maxIndex));
            
            const translateX = -currentIndex * cardWidth;
            box.style.transform = `translateX(${translateX}px)`;
            
            // Actualizar estado de las flechas
            leftArrow.disabled = currentIndex === 0;
            rightArrow.disabled = currentIndex >= maxIndex;
        }
        
        // Función para verificar que las tarjetas sean visibles
        function ensureCardsVisible() {
            const containerRect = carouselContainer.getBoundingClientRect();
            const boxRect = box.getBoundingClientRect();
            
            // Si el contenido se sale por la derecha, ajustar
            if (boxRect.right > containerRect.right - 60) { // 60px para la flecha derecha
                const overflow = boxRect.right - (containerRect.right - 60);
                const currentTransform = box.style.transform;
                const currentX = currentTransform ? parseInt(currentTransform.match(/-?\d+/)?.[0] || 0) : 0;
                box.style.transform = `translateX(${currentX - overflow}px)`;
            }
        }
        
        // Event listeners para las flechas
        leftArrow.addEventListener('click', function() {
            if (currentIndex > 0) {
                currentIndex = Math.max(0, currentIndex - SCROLL_AMOUNT);
                updateCarousel();
                setTimeout(ensureCardsVisible, 50); // Pequeño delay para que la animación termine
            }
        });
        
        rightArrow.addEventListener('click', function() {
            const maxIndex = getMaxIndex();
            if (currentIndex < maxIndex) {
                currentIndex = Math.min(maxIndex, currentIndex + SCROLL_AMOUNT);
                updateCarousel();
                setTimeout(ensureCardsVisible, 50); // Pequeño delay para que la animación termine
            }
        });
        
        // Soporte para navegación con teclado
        leftArrow.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                leftArrow.click();
            }
        });
        
        rightArrow.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                rightArrow.click();
            }
        });
        
        // Soporte para navegación con flechas del teclado en toda la sección
        section.addEventListener('keydown', function(e) {
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                leftArrow.click();
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                rightArrow.click();
            }
        });
        
        // Actualizar carrusel al redimensionar la ventana
        let resizeTimeout;
        window.addEventListener('resize', function() {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(function() {
                // Recalcular maxIndex en caso de que cambie el número de tarjetas visibles
                const newMaxIndex = Math.max(0, cards.length - CARDS_TO_SHOW);
                if (currentIndex > newMaxIndex) {
                    currentIndex = newMaxIndex;
                }
                updateCarousel();
            }, 250);
        });
        
        // Soporte para gestos táctiles (opcional)
        let startX = 0;
        let isDragging = false;
        
        box.addEventListener('touchstart', function(e) {
            startX = e.touches[0].clientX;
            isDragging = true;
        });
        
        box.addEventListener('touchmove', function(e) {
            if (!isDragging) return;
            e.preventDefault();
        });
        
        box.addEventListener('touchend', function(e) {
            if (!isDragging) return;
            isDragging = false;
            
            const endX = e.changedTouches[0].clientX;
            const diffX = startX - endX;
            
            // Si el deslizamiento es significativo (más de 50px)
            if (Math.abs(diffX) > 50) {
                if (diffX > 0) {
                    // Deslizar hacia la izquierda (mostrar siguiente)
                    rightArrow.click();
                } else {
                    // Deslizar hacia la derecha (mostrar anterior)
                    leftArrow.click();
                }
            }
        });
        
        // Listener para redimensionamiento de ventana
        window.addEventListener('resize', function() {
            updateCarousel();
            setTimeout(ensureCardsVisible, 100);
        });

        // Inicializar el carrusel
        updateCarousel();
        setTimeout(ensureCardsVisible, 100);
        
        // Agregar indicador visual de que hay más contenido
        if (cards.length > CARDS_TO_SHOW) {
            carouselContainer.setAttribute('data-has-overflow', 'true');
        }
    }
    
    // Función para reinicializar todos los carruseles (útil para contenido dinámico)
    function reinitializeCarousels() {
        // Limpiar carruseles existentes
        document.querySelectorAll('.carousel-container').forEach(container => {
            const box = container.querySelector('.box');
            if (box) {
                // Restaurar el box a su posición original
                container.parentNode.insertBefore(box, container);
                container.remove();
                box.style.transform = '';
            }
        });
        
        // Reinicializar carruseles para ambas secciones
        initializeCarousel('.principalbox:first-of-type'); // Sección "Mis Torneos"
        initializeCarousel('.principalbox:nth-of-type(2)'); // Sección "Mis Equipos"
    }
    
    // Inicializar carruseles para ambas secciones
    const allSections = document.querySelectorAll('.principalbox');
    allSections.forEach((section, index) => {
        const title = section.querySelector('.title');
        if (title) {
            const titleText = title.textContent.trim();
            if (titleText === 'Mis Torneos') {
                initializeCarousel('.principalbox:first-of-type');
            } else if (titleText === 'Mis equipos') {
                initializeCarousel('.principalbox:nth-of-type(2)');
            }
        }
    });
    
    // Exponer función global para reinicializar (útil si se actualiza el contenido dinámicamente)
    window.reinitializeTournamentCarousel = reinitializeCarousels;
    
    // Observer para detectar cambios en el contenido (opcional)
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList') {
                const target = mutation.target;
                if (target.classList.contains('box') || target.closest('.principalbox')) {
                    // Reinicializar carrusel si se detectan cambios en las tarjetas
                    setTimeout(reinitializeCarousels, 100);
                }
            }
        });
    });
    
    // Observar cambios en ambas secciones
    const tournamentSection = document.querySelector('.principalbox:first-of-type');
    const teamsSection = document.querySelector('.principalbox:nth-of-type(2)');
    
    if (tournamentSection) {
        observer.observe(tournamentSection, {
            childList: true,
            subtree: true
        });
    }
    
    if (teamsSection) {
        observer.observe(teamsSection, {
            childList: true,
            subtree: true
        });
    }
});