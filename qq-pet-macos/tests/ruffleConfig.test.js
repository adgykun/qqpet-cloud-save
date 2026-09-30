/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

describe('Ruffle Configuration and Overlay Hiding Tests', () => {
  test('app.html should have RufflePlayer config disabling splash screen, preloader, and unmuteOverlay', () => {
    const htmlPath = path.join(__dirname, '../src/windows/app.html');
    const content = fs.readFileSync(htmlPath, 'utf8');

    expect(content).toContain('splashScreen: false');
    expect(content).toContain('showSplashScreen: false');
    expect(content).toContain('preloader: false');
    expect(content).toContain('unmuteOverlay: "hidden"');
  });

  test('fishing/indexOnLine.html and backRoom/indexOnLine.html should have updated RufflePlayer config', () => {
    const fishingPath = path.join(__dirname, '../src/windows/popups/fishing/indexOnLine.html');
    const backRoomPath = path.join(__dirname, '../src/windows/popups/backRoom/indexOnLine.html');

    const fishingContent = fs.readFileSync(fishingPath, 'utf8');
    const backRoomContent = fs.readFileSync(backRoomPath, 'utf8');

    expect(fishingContent).toContain('splashScreen: false');
    expect(fishingContent).toContain('showSplashScreen: false');
    expect(fishingContent).toContain('preloader: false');

    expect(backRoomContent).toContain('splashScreen: false');
    expect(backRoomContent).toContain('showSplashScreen: false');
    expect(backRoomContent).toContain('preloader: false');
  });

  test('CSS files should contain rules targeting Ruffle logo and splash screen overlays', () => {
    const mainCssPath = path.join(__dirname, '../src/windows/main/index.css');
    const indexCssPath = path.join(__dirname, '../src/windows/css/index.css');

    const mainCss = fs.readFileSync(mainCssPath, 'utf8');
    const indexCss = fs.readFileSync(indexCssPath, 'utf8');

    expect(mainCss).toContain('#splash-screen');
    expect(mainCss).toContain('.logo');
    expect(mainCss).toContain('display: none !important');

    expect(indexCss).toContain('#splash-screen');
    expect(indexCss).toContain('.logo');
    expect(indexCss).toContain('display: none !important');
  });

  test('app.html should include MutationObserver script for hiding Shadow DOM overlay elements', () => {
    const htmlPath = path.join(__dirname, '../src/windows/app.html');
    const content = fs.readFileSync(htmlPath, 'utf8');

    expect(content).toContain('applyStyleToShadow');
    expect(content).toContain('#ruffle-overlay-hide-style');
  });

  test('Simulated action switching (Walk -> Eat -> Wash -> Walk) does not throw errors', () => {
    document.body.innerHTML = '<div id="pet-container"><embed id="pet" name="pet" class="pet" src="../../assets/Action/GG/Adult/happy/Stand.swf"></embed></div>';

    const dom = document.getElementById('pet');
    expect(dom).not.toBeNull();

    const nextSwfs = [
      { src: '../../assets/Action/GG/Adult/happy/P/P1.swf' }, // Walk / Play
      { src: '../../assets/Action/GG/Adult/Eat1.swf' },       // Eat
      { src: '../../assets/Action/GG/Adult/Clean1.swf' },     // Wash
      { src: '../../assets/Action/GG/Adult/happy/Stand.swf' } // Walk / Stand
    ];

    nextSwfs.forEach((swfOpt) => {
      const currentDom = document.getElementById('pet');
      expect(currentDom).toBeTruthy();
      const clone = currentDom.cloneNode(true);
      clone.setAttribute('src', swfOpt.src);
      currentDom.parentNode.appendChild(clone);
      currentDom.remove();
      clone.id = 'pet';
    });

    const finalDom = document.getElementById('pet');
    expect(finalDom.getAttribute('src')).toBe('../../assets/Action/GG/Adult/happy/Stand.swf');
  });
});
