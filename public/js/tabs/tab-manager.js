const TAB_NAMES = ['profile', 'otsumami', 'stamps', 'ohinerimaki', 'vcast'];
const loadedTabs = new Set();
const loadingTabs = new Map();

function capitalize(value) {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

function getInitFunctionName(tabName) {
  return `init${capitalize(tabName)}Tab`;
}

function setActiveTab(tabName) {
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });

  document.querySelectorAll('.tab-pane').forEach((pane) => {
    pane.style.display = 'none';
  });

  const targetPane = document.getElementById(`tab-${tabName}`);
  if (targetPane) {
    targetPane.style.display = 'block';
  }
}

async function loadTab(tabName) {
  if (loadedTabs.has(tabName)) {
    return;
  }

  if (loadingTabs.has(tabName)) {
    await loadingTabs.get(tabName);
    return;
  }

  const container = document.getElementById(`tab-${tabName}`);
  if (!container) {
    console.error(`[Tabs] tab-${tabName} が見つかりません`);
    return;
  }

  const loadPromise = (async () => {
    try {
      const response = await fetch(`${tabName}-tab.html`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const html = await response.text();
      container.innerHTML = html;
      console.log(`[Tabs] ${tabName}-tab.html を読み込みました`);

      const module = await import(`./${tabName}-tab-init.js`);
      const initFn = module[getInitFunctionName(tabName)];
      if (typeof initFn === 'function') {
        await initFn();
      } else {
        console.warn(`[Tabs] ${tabName} の初期化関数が見つかりません`);
      }

      loadedTabs.add(tabName);
      console.log(`[Tabs] ✅ ${tabName} タブの読み込み完了`);
    } catch (error) {
      console.error(`[Tabs] ❌ ${tabName} タブの読み込み失敗:`, error);
      container.innerHTML = '';
      const section = document.createElement('div');
      section.className = 'section';
      const message = document.createElement('p');
      message.style.color = 'red';
      message.textContent = `${tabName}タブの読み込みに失敗しました`;
      section.appendChild(message);
      container.appendChild(section);
    } finally {
      loadingTabs.delete(tabName);
    }
  })();

  loadingTabs.set(tabName, loadPromise);
  await loadPromise;
}

function handleTabClick(event) {
  const tabButton = event.target.closest('.tab');
  if (!tabButton || tabButton.disabled) return;

  const tabName = tabButton.dataset.tab;
  if (!TAB_NAMES.includes(tabName)) return;

  setActiveTab(tabName);
  loadTab(tabName);
}

function initTabs() {
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', handleTabClick);
  });

  const activeTab = document.querySelector('.tab.active')?.dataset.tab || 'profile';
  setActiveTab(activeTab);
  loadTab(activeTab);
}

window.tabManager = {
  loadTab,
  setActiveTab,
  initTabs
};

window.addEventListener('load', initTabs);
