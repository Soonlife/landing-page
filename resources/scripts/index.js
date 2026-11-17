/*
    index.js
    homepage

    Created by Js Na on 2026/10/16.
    Copyright © 2026 Js Na. All rights reserved.
*/

// 스크롤해서 화면에 들어온 요소를 한 번만 부드럽게 드러냄
// 스크립트가 실행될 때만 숨겨 두므로, 스크립트가 없으면 처음부터 다 보임
document.documentElement.classList.add('hasReveal');

const revealObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
        if (entry.isIntersecting) {
            entry.target.classList.add('isRevealed');
            revealObserver.unobserve(entry.target);
        }
    }
}, { rootMargin: '0px 0px -10% 0px' });

document.querySelectorAll('.Reveal, .Card').forEach((element) => revealObserver.observe(element));

// 상단 바: 지금 보고 있는 섹션의 메뉴를 표시하고, 검은 무대를 지나면 밝게 바꿈
const localNav = document.querySelector('.LocalNav');
const navLinks = [...localNav.querySelectorAll('.NavLinks a')];
const sections = navLinks.map((link) => document.querySelector(link.hash));
const highlights = document.querySelector('.Highlights');

function updateLocalNav() {
    const line = localNav.getBoundingClientRect().bottom + 1;
    localNav.classList.toggle('isLight', highlights.getBoundingClientRect().bottom <= line);

    let current = 0;
    sections.forEach((section, index) => {
        if (section.getBoundingClientRect().top <= line + 80) current = index;
    });
    navLinks.forEach((link, index) => link.classList.toggle('isActive', index === current));
}

addEventListener('scroll', updateLocalNav, { passive: true });
addEventListener('resize', updateLocalNav);
updateLocalNav();

// 하이라이트: 점을 누르면 그 카드로, 넘기면 점이 따라옴. 화면에 보이는 동안 5초마다 다음 카드로
// 자동 넘김은 멈춤 버튼으로 끌 수 있고, 직접 넘기거나 점을 누르면 멈춤 (움직임 줄이기 설정이면 처음부터 멈춤)
const gallery = document.querySelector('[data-gallery]');
if (gallery) {
    const track = gallery.querySelector('.GalleryTrack');
    const slides = [...track.children];
    const playButton = gallery.querySelector('[data-gallery-play]');
    const dots = slides.map((slide, index) => {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.setAttribute('aria-label', `하이라이트 ${index + 1} / ${slides.length}`);
        dot.addEventListener('click', () => {
            setPaused(true);
            goTo(index);
        });
        return dot;
    });
    gallery.querySelector('.GalleryDots').append(...dots);

    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    let current = 0;
    let timer = 0;
    let visible = false;
    let paused = reducedMotion.matches;

    function goTo(index) {
        const slide = slides[index];
        track.scrollTo({ left: slide.offsetLeft - (track.clientWidth - slide.clientWidth) / 2, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    }

    function schedule() {
        clearTimeout(timer);
        if (paused || !visible || document.hidden) return;
        timer = setTimeout(() => goTo((current + 1) % slides.length), 5000);
    }

    function setPaused(value) {
        paused = value;
        playButton.setAttribute('aria-pressed', String(paused));
        playButton.setAttribute('aria-label', paused ? '자동 넘김 다시 시작' : '자동 넘김 멈추기');
        schedule();
    }

    playButton.addEventListener('click', () => setPaused(!paused));
    track.addEventListener('pointerdown', () => setPaused(true));
    track.addEventListener('wheel', (event) => {
        if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) setPaused(true);
    }, { passive: true });

    const slideObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (entry.intersectionRatio > 0.6) {
                current = slides.indexOf(entry.target);
                dots.forEach((dot, index) => dot.toggleAttribute('aria-current', index === current));
                dots[current].setAttribute('aria-current', 'true');
                schedule();
            }
        }
    }, { root: track, threshold: 0.6 });
    slides.forEach((slide) => slideObserver.observe(slide));

    new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        schedule();
    }).observe(gallery);
    document.addEventListener('visibilitychange', schedule);
    dots[0].setAttribute('aria-current', 'true');
    setPaused(paused);
}

// 기능 카드: 화살표로 한 장씩 넘기고, 끝에 닿으면 화살표를 흐리게
document.querySelectorAll('[data-cards]').forEach((cards) => {
    const track = cards.querySelector('.CardTrack');
    const prev = cards.querySelector('[data-prev]');
    const next = cards.querySelector('[data-next]');
    const step = () => track.firstElementChild.getBoundingClientRect().width + 20;

    function update() {
        prev.disabled = track.scrollLeft <= 4;
        next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
    }

    prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
    next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));
    track.addEventListener('scroll', update, { passive: true });
    addEventListener('resize', update);
    update();
});

// 순버스 노선 고르기: 전체 → 등교 → 하교 → 학내순환을 차례로 고르고, 3D 버스가 한 바퀴 돌며 그 노선 색으로 바뀜
// 색은 앱 routeColor의 대표 노선 색 (등교직행 #2D85F0, 하교직행 #ED7B35, 학내순환 #049A5C), 전체는 모델 원래 색
// three.js 번들(약 160KB)과 모델(72KB)은 카드가 화면 가까이 왔을 때만 불러오고, 화면 밖에서는 멈춤
const busStage = document.querySelector('[data-bus-stage]');
if (busStage) {
    const chips = [...busStage.querySelectorAll('[data-bus-color]')];
    const modelBox = busStage.querySelector('[data-bus-model]');
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const scriptBase = document.querySelector('script[src*="index.js"]').src;
    let bus = null;
    let index = 0;
    let timer = 0;
    let visible = false;

    function select(next) {
        index = next;
        chips.forEach((chip, i) => {
            chip.classList.toggle('isActive', i === index);
            chip.setAttribute('aria-pressed', String(i === index));
        });
        bus?.turn(chips[index].dataset.busColor || null);
    }

    let dragging = false;

    function schedule(delay = 2400) {
        clearTimeout(timer);
        if (dragging || !visible || document.hidden || reducedMotion.matches) return;
        timer = setTimeout(() => {
            select((index + 1) % chips.length);
            schedule();
        }, delay);
    }

    // 칩을 누르면 그 노선으로 바꾸고 버스가 한 바퀴 돌며 색이 바뀜. 고른 노선을 볼 수 있게 6초 쉬었다가 자동 전환을 이어 감
    chips.forEach((chip, i) => chip.addEventListener('click', () => {
        load();
        select(i);
        schedule(6000);
    }));

    // 버스를 끌어 돌리는 동안은 다음 노선으로 넘기지 않고, 놓으면 다시 이어 감
    modelBox.addEventListener('busdrag', (event) => {
        dragging = event.detail;
        schedule();
    });

    let loading = null;
    function load() {
        loading ??= import(new URL('../build/bus3d.js', scriptBase).href)
            .then(({ mountBus }) => mountBus(modelBox, new URL('../models/shuttle-bus.glb', scriptBase).href))
            .then((handle) => {
                bus = handle;
            })
            .catch(() => modelBox.classList.add('isFailed'));
        return loading;
    }

    new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) load();
    }, { rootMargin: '400px' }).observe(busStage);

    new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        schedule();
    }).observe(busStage);
    document.addEventListener('visibilitychange', schedule);
    reducedMotion.addEventListener('change', schedule);
}

// 첫차·막차 시간: 카드가 화면에 들어올 때마다 숫자가 0부터 두 바퀴 굴러 제자리(08:10 등)에 멈춤
// 자리마다 조금씩 늦게 멈춰 촤르륵 맞춰지는 느낌. 화면 낭독기는 aria-label의 실제 시간을 읽음
const rollTargets = [...document.querySelectorAll('[data-roll]')];
if (rollTargets.length) {
    const strips = [];
    rollTargets.forEach((target, targetIndex) => {
        const text = target.textContent.trim();
        target.setAttribute('aria-label', text);
        target.classList.add('Roll');
        const parts = [...text].map((char, charIndex) => {
            if (!/\d/.test(char)) {
                const sep = document.createElement('span');
                sep.className = 'RollSep';
                sep.textContent = char;
                sep.setAttribute('aria-hidden', 'true');
                return sep;
            }
            const digit = document.createElement('span');
            digit.className = 'RollDigit';
            digit.setAttribute('aria-hidden', 'true');
            const strip = document.createElement('span');
            strip.className = 'RollStrip';
            // 0~9를 세 번 이어 붙여, 0에서 출발해 두 바퀴 돈 뒤 목표 숫자에 멈춤
            for (let i = 0; i < 30; i++) {
                const n = document.createElement('span');
                n.textContent = String(i % 10);
                strip.append(n);
            }
            strip.dataset.to = String(20 + Number(char));
            strip.style.setProperty('--delay', `${targetIndex * 0.15 + charIndex * 0.12}s`);
            digit.append(strip);
            strips.push(strip);
            return digit;
        });
        target.replaceChildren(...parts);
    });

    const settle = () => strips.forEach((strip) => strip.style.setProperty('--to', strip.dataset.to));
    const reset = () => strips.forEach((strip) => {
        strip.classList.add('isReset');
        strip.style.setProperty('--to', '0');
    });

    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
        settle();
    } else {
        reset();
        new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                // 처음 위치를 그린 다음 프레임에 굴리기 시작
                requestAnimationFrame(() => {
                    strips.forEach((strip) => strip.classList.remove('isReset'));
                    requestAnimationFrame(settle);
                });
            } else {
                reset();
            }
        }, { threshold: 0.6 }).observe(rollTargets[0].closest('.ACard'));
    }
}

// 첫 화면 워드마크: 「순」 뒤 서비스 이름이 일정 간격으로 하나씩 올라왔다가 위로 사라짐
const serviceNameScrollView = document.getElementById('ServiceNameScrollView');
if (serviceNameScrollView) {
    const serviceNames = [...serviceNameScrollView.children];
    // 처음에는 data-centered가 붙은 이름(라이프)을 보여 줌
    const centeredIndex = serviceNames.findIndex((serviceName) => serviceName.hasAttribute('data-centered'));
    const serviceNameWidths = serviceNames.map(() => 0);
    const serviceNameInterval = 2000;
    const reducedMotionQuery = matchMedia('(prefers-reduced-motion: reduce)');
    let currentIndex = -1;
    let rotationTimer = 0;
    let isWordmarkVisible = false;

    // 글자마다 span으로 감싸 따로 움직이게 함. 공백은 텍스트 노드로 두어 단어 간격을 유지하고,
    // 단어 사이에서만 순번을 한 칸 띄움 (HTML 들여쓰기 공백은 무시)
    const graphemeSegmenter = new Intl.Segmenter('ko', { granularity: 'grapheme' });

    const splitIntoCharacters = (serviceName) => {
        const textNodeWalker = document.createTreeWalker(serviceName, NodeFilter.SHOW_TEXT);
        const textNodes = [];
        while (textNodeWalker.nextNode()) textNodes.push(textNodeWalker.currentNode);

        let characterIndex = 0;
        let hasWordGap = false;
        for (const textNode of textNodes) {
            const fragment = document.createDocumentFragment();
            for (const { segment } of graphemeSegmenter.segment(textNode.data)) {
                if (segment.trim() === '') {
                    fragment.append(segment);
                    hasWordGap = characterIndex > 0;
                    continue;
                }
                if (hasWordGap) {
                    characterIndex++;
                    hasWordGap = false;
                }
                const character = document.createElement('span');
                character.className = 'character';
                character.style.setProperty('--characterIndex', characterIndex++);
                character.textContent = segment;
                fragment.append(character);
            }
            textNode.replaceWith(fragment);
        }
    };

    serviceNames.forEach(splitIntoCharacters);

    // 칸 폭을 지금 보이는 이름 너비로 맞춤. 폭이 부드럽게 바뀌면서 「순」과 이름 전체가 늘 가운데에 옴
    const fitSlot = (index) => {
        if (serviceNameWidths[index]) serviceNameScrollView.style.width = `${serviceNameWidths[index]}px`;
    };

    const showServiceName = (index) => {
        fitSlot(index);
        serviceNames.forEach((serviceName, nameIndex) => {
            serviceName.classList.toggle('show', nameIndex === index);
            // 방금까지 보이던 이름만 위로 사라지고, 나머지는 아래에서 다음 차례를 기다림
            serviceName.classList.toggle('hide', nameIndex === currentIndex && nameIndex !== index);
        });
        currentIndex = index;
    };

    // 워드마크가 화면에 보이고, 탭이 앞에 있고, 움직임 줄이기 설정이 아닐 때만 돌림
    const scheduleRotation = () => {
        clearTimeout(rotationTimer);
        if (!isWordmarkVisible || document.hidden || reducedMotionQuery.matches) return;
        rotationTimer = setTimeout(() => {
            showServiceName((currentIndex + 1) % serviceNames.length);
            scheduleRotation();
        }, serviceNameInterval);
    };

    new IntersectionObserver(([entry]) => {
        isWordmarkVisible = entry.isIntersecting;
        scheduleRotation();
    }).observe(serviceNameScrollView);

    document.addEventListener('visibilitychange', scheduleRotation);
    reducedMotionQuery.addEventListener('change', scheduleRotation);

    // 웹폰트 로드, 화면 폭에 따른 글자 크기 변화를 모두 여기서 받아 칸 폭을 다시 맞춤
    // 처음 한 번은 트랜지션 없이 기준 이름을 보여 줌
    const serviceNameResizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
            serviceNameWidths[serviceNames.indexOf(entry.target)] = entry.borderBoxSize[0].inlineSize;
        }
        if (currentIndex !== -1) fitSlot(currentIndex);

        if (currentIndex === -1) {
            serviceNameScrollView.classList.add('noTransition');
            showServiceName(Math.max(centeredIndex, 0));
            void serviceNameScrollView.offsetWidth;
            serviceNameScrollView.classList.remove('noTransition');
        }
    });

    serviceNames.forEach((serviceName) => serviceNameResizeObserver.observe(serviceName));
}

// 첫 화면: 떠 있는 카드들이 순 아이콘에서 한꺼번에 촥 터져 나옴
// 카드마다 아이콘 가운데까지의 거리를 재서 거기서 한꺼번에 출발시킴. 그 순간 아이콘이 한 번 꿀렁함 (움직임 줄이기 설정이면 그냥 보여 줌)
const heroStage = document.querySelector('.HeroStage');
if (heroStage && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const icon = heroStage.querySelector('.HeroIcon');
    const floats = [...heroStage.querySelectorAll('.Float')];
    document.documentElement.classList.add('hasBurst');

    const burst = () => {
        const target = icon.getBoundingClientRect();
        const cx = target.left + target.width / 2;
        const cy = target.top + target.height / 2;
        floats.forEach((float) => {
            const box = float.getBoundingClientRect();
            float.style.setProperty('--fromX', `${cx - (box.left + box.width / 2)}px`);
            float.style.setProperty('--fromY', `${cy - (box.top + box.height / 2)}px`);
        });
        heroStage.classList.add('isBursting');
        document.documentElement.classList.remove('hasBurst');
    };

    // 페이지를 연 뒤 약 0.2초에 터뜨림 (스크립트가 실행되기까지 걸린 시간을 빼서 맞춤. 아이콘은 처음부터 제자리)
    setTimeout(burst, Math.max(0, 200 - performance.now()));
}

// 순맵 검색창: 화면에 들어오면 "M502"를 한 글자씩 입력. 화면에서 나가면 지워 두고 다시 들어올 때 다시 입력
const searchBoxes = document.querySelectorAll('.ASearch');
if (searchBoxes.length && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const typeTimers = new Map();

    const resetSearch = (box) => {
        clearTimeout(typeTimers.get(box));
        box.querySelector('span').textContent = '';
        box.classList.remove('isTyping');
    };

    const typeSearch = (box) => {
        const target = box.dataset.query;
        const field = box.querySelector('span');
        let count = 0;
        box.classList.add('isTyping');
        const step = () => {
            count += 1;
            field.textContent = target.slice(0, count);
            if (count < target.length) {
                typeTimers.set(box, setTimeout(step, 90 + Math.random() * 50));
            } else {
                box.classList.remove('isTyping');
            }
        };
        typeTimers.set(box, setTimeout(step, 350));
    };

    const searchObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) typeSearch(entry.target);
            else resetSearch(entry.target);
        });
    }, { threshold: 0.6 });

    searchBoxes.forEach((box) => {
        const field = box.querySelector('span');
        box.dataset.query = field.textContent;
        box.setAttribute('aria-label', `검색어 ${field.textContent}`);
        field.setAttribute('aria-hidden', 'true');
        resetSearch(box);
        searchObserver.observe(box);
    });
}
