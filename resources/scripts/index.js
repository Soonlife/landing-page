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
}, { rootMargin: '0px 0px -12% 0px' });

document.querySelectorAll('.Reveal').forEach((element) => revealObserver.observe(element));
