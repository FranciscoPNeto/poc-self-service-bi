// Estado Global do Studio (Fabric Apps / Power BI Studio)
const state = {
  datasetsWithSchemas: [],
  pages: [],
  activePageIndex: 0,
  defaultVisualType: 'kpi',
  chartInstances: {},
  draggedField: null,
  selectedVisualId: null,
  theme: 'light' // 'light' ou 'dark'
};

const dom = {
  fieldsContainer: document.getElementById('dataset-fields-container'),
  totalBadge: document.getElementById('total-datasets-badge'),
  dropzone: document.getElementById('canvas-dropzone'),
  grid: document.getElementById('visuals-container-grid'),
  pageTabs: document.getElementById('page-tabs-container'),
  btnAddPage: document.getElementById('btn-add-new-page'),
  btnDeletePage: document.getElementById('btn-delete-active-page'),
  inpActivePageName: document.getElementById('inp-active-page-name'),
  visualTypesPicker: document.getElementById('visual-types-picker'),
  btnSavePages: document.getElementById('btn-save-pages'),
  btnOpenAdd: document.getElementById('btn-open-add-dataset'),
  btnViewDef: document.getElementById('btn-view-definition'),
  btnExport: document.getElementById('btn-export-fabric-report'),
  btnToggleTheme: document.getElementById('btn-toggle-theme'),
  themeBtnText: document.getElementById('theme-btn-text'),
  themeIcon: document.getElementById('theme-icon'),
  // Menu de Atualização / Refresh
  dropdownRefreshWrapper: document.getElementById('dropdown-refresh-wrapper'),
  btnRefreshMenu: document.getElementById('btn-refresh-menu'),
  btnRefreshVisuals: document.getElementById('btn-refresh-visuals'),
  btnRefreshSemanticModels: document.getElementById('btn-refresh-semantic-models'),
  btnRefreshAll: document.getElementById('btn-refresh-all'),
  btnQuickRefreshSchemas: document.getElementById('btn-quick-refresh-schemas'),
  // Templates
  btnExportTemplate: document.getElementById('btn-export-template'),
  btnOpenTemplatesModal: document.getElementById('btn-open-templates-modal'),
  modalTemplates: document.getElementById('modal-templates'),
  modalTemplatesClose: document.getElementById('modal-templates-close'),
  modalTemplatesOk: document.getElementById('modal-templates-ok'),
  inpSaveTemplateName: document.getElementById('inp-save-template-name'),
  btnSaveAsTemplate: document.getElementById('btn-save-as-template'),
  templatesListContainer: document.getElementById('templates-list-container'),
  btnTriggerFileImport: document.getElementById('btn-trigger-file-import'),
  inpImportTemplateFile: document.getElementById('inp-import-template-file'),
  // Painel de Personalização de Visual
  customizerPanel: document.getElementById('visual-customizer-panel'),
  inpCustomTitle: document.getElementById('inp-custom-title'),
  selCustomWidth: document.getElementById('sel-custom-width'),
  colorPresetsContainer: document.getElementById('color-presets-container'),
  // Modais
  modalAdd: document.getElementById('modal-add-ds'),
  modalAddClose: document.getElementById('modal-add-close'),
  modalAddCancel: document.getElementById('modal-add-cancel'),
  modalAddSave: document.getElementById('modal-add-save'),
  modalDef: document.getElementById('modal-definition'),
  modalDefClose: document.getElementById('modal-def-close'),
  modalDefOk: document.getElementById('modal-def-ok'),
  defJsonView: document.getElementById('def-json-view'),
  toast: document.getElementById('fabric-toast'),
  toastText: document.getElementById('toast-text'),
  inpName: document.getElementById('inp-ds-name'),
  inpWid: document.getElementById('inp-ds-wid'),
  inpId: document.getElementById('inp-ds-id'),
  inpDesc: document.getElementById('inp-ds-desc'),
  inpCanvasFilter: document.getElementById('inp-canvas-filter')
};

document.addEventListener('DOMContentLoaded', async () => {
  setupHandlers();
  initTheme();
  await loadDatasetsAndSchemas();
  await loadPagesState();
});

function notify(text) {
  dom.toastText.textContent = text;
  dom.toast.classList.add('show');
  setTimeout(() => dom.toast.classList.remove('show'), 2800);
}

function initTheme() {
  const saved = localStorage.getItem('fabric_theme') || 'light';
  setTheme(saved);
}

function setTheme(themeName) {
  state.theme = themeName;
  localStorage.setItem('fabric_theme', themeName);

  if (themeName === 'dark') {
    document.body.classList.add('dark-mode');
    dom.themeBtnText.textContent = 'Modo Claro';
    dom.themeIcon.innerHTML = `<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>`;
  } else {
    document.body.classList.remove('dark-mode');
    dom.themeBtnText.textContent = 'Modo Escuro';
    dom.themeIcon.innerHTML = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>`;
  }

  // Atualiza cores de eixos e textos em todos os gráficos existentes
  refreshAllChartsTheme();
}

function refreshAllChartsTheme() {
  const isDark = state.theme === 'dark';
  const textColor = isDark ? '#B0B3B8' : '#605E5C';
  const gridColor = isDark ? '#3A3B3C' : '#EDEBE9';

  Object.values(state.chartInstances).forEach(chart => {
    if (!chart || !chart.options) return;
    if (chart.options.scales) {
      if (chart.options.scales.x) {
        chart.options.scales.x.ticks.color = textColor;
      }
      if (chart.options.scales.y) {
        chart.options.scales.y.ticks.color = textColor;
        chart.options.scales.y.grid.color = gridColor;
      }
    }
    chart.update();
  });
}

function setupHandlers() {
  // Alternar Tema Dark / Light
  dom.btnToggleTheme.addEventListener('click', () => {
    setTheme(state.theme === 'dark' ? 'light' : 'dark');
    notify(`Tema alterado para: ${state.theme === 'dark' ? 'Modo Escuro' : 'Modo Claro'}`);
  });

  // Dropdown de Atualização
  dom.btnRefreshMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    dom.dropdownRefreshWrapper.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (!dom.dropdownRefreshWrapper.contains(e.target)) {
      dom.dropdownRefreshWrapper.classList.remove('open');
    }
  });

  dom.btnRefreshVisuals.addEventListener('click', () => {
    dom.dropdownRefreshWrapper.classList.remove('open');
    refreshVisualsOnly();
  });

  dom.btnRefreshSemanticModels.addEventListener('click', () => {
    dom.dropdownRefreshWrapper.classList.remove('open');
    refreshSemanticModelsOnly();
  });

  dom.btnRefreshAll.addEventListener('click', () => {
    dom.dropdownRefreshWrapper.classList.remove('open');
    refreshAllDashboard();
  });

  if (dom.btnQuickRefreshSchemas) {
    dom.btnQuickRefreshSchemas.addEventListener('click', () => {
      refreshSemanticModelsOnly();
    });
  }

  // Exportar Template em Arquivo JSON
  dom.btnExportTemplate.addEventListener('click', exportTemplateAsFile);

  // Modal de Templates
  dom.btnOpenTemplatesModal.addEventListener('click', () => {
    dom.modalTemplates.classList.add('open');
    loadTemplatesList();
  });
  dom.modalTemplatesClose.addEventListener('click', () => dom.modalTemplates.classList.remove('open'));
  dom.modalTemplatesOk.addEventListener('click', () => dom.modalTemplates.classList.remove('open'));
  dom.btnSaveAsTemplate.addEventListener('click', saveCurrentAsTemplate);

  // Importar arquivo JSON local de template
  dom.btnTriggerFileImport.addEventListener('click', () => dom.inpImportTemplateFile.click());
  dom.inpImportTemplateFile.addEventListener('change', handleImportTemplateFile);

  // Modal de adicionar dataset
  dom.btnOpenAdd.addEventListener('click', () => dom.modalAdd.classList.add('open'));
  dom.modalAddClose.addEventListener('click', () => dom.modalAdd.classList.remove('open'));
  dom.modalAddCancel.addEventListener('click', () => dom.modalAdd.classList.remove('open'));
  dom.modalAddSave.addEventListener('click', handleSaveDataset);

  // Modal de definição PBIR
  dom.btnViewDef.addEventListener('click', showPBIRDefinition);
  dom.modalDefClose.addEventListener('click', () => dom.modalDef.classList.remove('open'));
  dom.modalDefOk.addEventListener('click', () => dom.modalDef.classList.remove('open'));

  // Salvar e Exportar
  dom.btnSavePages.addEventListener('click', savePagesToServer);
  dom.btnExport.addEventListener('click', exportFabricReport);

  // Menu de Ações Mobile ("...")
  const btnMobileActions = document.getElementById('btn-mobile-actions');
  const dropdownMobileWrapper = document.getElementById('dropdown-mobile-actions-wrapper');
  if (btnMobileActions && dropdownMobileWrapper) {
    btnMobileActions.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdownMobileWrapper.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      if (!dropdownMobileWrapper.contains(e.target)) {
        dropdownMobileWrapper.classList.remove('open');
      }
    });

    const bindMobileBtn = (mobileId, targetBtn) => {
      const el = document.getElementById(mobileId);
      if (el && targetBtn) {
        el.addEventListener('click', () => {
          dropdownMobileWrapper.classList.remove('open');
          targetBtn.click();
        });
      }
    };

    bindMobileBtn('btn-mobile-save', dom.btnSavePages);
    bindMobileBtn('btn-mobile-export', dom.btnExport);
    bindMobileBtn('btn-mobile-export-template', dom.btnExportTemplate);
    bindMobileBtn('btn-mobile-templates', dom.btnOpenTemplatesModal);
    bindMobileBtn('btn-mobile-add-ds', dom.btnOpenAdd);
    bindMobileBtn('btn-mobile-def', dom.btnViewDef);
  }

  // Navegação Mobile (Bottom Bar)
  setupMobileNavigation();

  // Busca / Filtro rápido no Canvas
  if (dom.inpCanvasFilter) {
    dom.inpCanvasFilter.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      document.querySelectorAll('.visual-card-canvas').forEach(card => {
        const titleEl = card.querySelector('.visual-card-title');
        const text = titleEl ? titleEl.textContent.toLowerCase() : '';
        if (!q || text.includes(q)) {
          card.style.display = '';
        } else {
          card.style.display = 'none';
        }
      });
    });
  }

  // Manipulação de Páginas
  dom.btnAddPage.addEventListener('click', addNewPage);
  dom.btnDeletePage.addEventListener('click', deleteActivePage);

  // Renomear página ativa
  dom.inpActivePageName.addEventListener('input', (e) => {
    const activePage = state.pages[state.activePageIndex];
    if (activePage) {
      activePage.name = e.target.value || 'Página Sem Nome';
      const activeTab = dom.pageTabs.children[state.activePageIndex];
      if (activeTab) activeTab.textContent = activePage.name;
    }
  });

  // Seletor de Tipo de Visual (Right Pane)
  dom.visualTypesPicker.querySelectorAll('.visual-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      dom.visualTypesPicker.querySelectorAll('.visual-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.defaultVisualType = btn.dataset.type;

      // Se houver visual selecionado, altera seu tipo também
      if (state.selectedVisualId) {
        const activePage = state.pages[state.activePageIndex];
        const v = activePage.visuals.find(x => x.id === state.selectedVisualId);
        if (v) {
          v.visualType = btn.dataset.type;
          v.colSpan = v.visualType === 'kpi' ? 3 : (v.visualType === 'table' ? 12 : 6);
          const card = document.getElementById(`card_${v.id}`);
          if (card) {
            card.className = `visual-card-canvas visual-col-${v.colSpan} selected-visual`;
            const sel = card.querySelector('.visual-type-select');
            if (sel) sel.value = v.visualType;
            if (state.chartInstances[v.id]) {
              try { state.chartInstances[v.id].destroy(); } catch (e) {}
              delete state.chartInstances[v.id];
            }
            renderVisualContent(v);
          }
        }
      }
      notify(`Tipo padrão definido: ${btn.querySelector('span').textContent}`);
    });
  });

  // Customizador do Visual Selecionado
  dom.inpCustomTitle.addEventListener('input', (e) => {
    if (!state.selectedVisualId) return;
    const activePage = state.pages[state.activePageIndex];
    const v = activePage.visuals.find(x => x.id === state.selectedVisualId);
    if (v) {
      v.title = e.target.value;
      const titleEl = document.querySelector(`#card_${v.id} .visual-card-title`);
      if (titleEl) titleEl.textContent = v.title;
    }
  });

  dom.selCustomWidth.addEventListener('change', (e) => {
    if (!state.selectedVisualId) return;
    const activePage = state.pages[state.activePageIndex];
    const v = activePage.visuals.find(x => x.id === state.selectedVisualId);
    if (v) {
      v.colSpan = parseInt(e.target.value);
      const card = document.getElementById(`card_${v.id}`);
      if (card) {
        card.className = `visual-card-canvas visual-col-${v.colSpan} selected-visual`;
      }
    }
  });

  dom.colorPresetsContainer.querySelectorAll('.color-preset-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      if (!state.selectedVisualId) return;
      const activePage = state.pages[state.activePageIndex];
      const v = activePage.visuals.find(x => x.id === state.selectedVisualId);
      if (v) {
        v.color = dot.dataset.color;
        const card = document.getElementById(`card_${v.id}`);
        if (card) {
          card.style.borderTop = `3px solid ${v.color}`;
          if (state.chartInstances[v.id]) {
            try { state.chartInstances[v.id].destroy(); } catch (e) {}
            delete state.chartInstances[v.id];
          }
          renderVisualContent(v);
        }
        highlightActiveColorPreset(v.color);
        notify('Cor de destaque atualizada.');
      }
    });
  });

  // Drag and Drop
  setupDragAndDrop();
}

function selectVisualForCustomization(v) {
  state.selectedVisualId = v ? v.id : null;

  document.querySelectorAll('.visual-card-canvas').forEach(c => c.classList.remove('selected-visual'));

  if (!v) {
    dom.customizerPanel.style.display = 'none';
    return;
  }

  const card = document.getElementById(`card_${v.id}`);
  if (card) card.classList.add('selected-visual');

  dom.customizerPanel.style.display = 'flex';
  dom.inpCustomTitle.value = v.title || v.measure || v.dimension;
  dom.selCustomWidth.value = String(v.colSpan || 6);

  // Destacar botão no picker de visual
  dom.visualTypesPicker.querySelectorAll('.visual-type-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === v.visualType);
  });

  highlightActiveColorPreset(v.color);
}

function highlightActiveColorPreset(color) {
  dom.colorPresetsContainer.querySelectorAll('.color-preset-dot').forEach(dot => {
    dot.classList.toggle('active', dot.dataset.color === color);
  });
}

function setupDragAndDrop() {
  const dropzone = dom.dropzone;
  const canvasArea = document.getElementById('canvas-area');

  [dropzone, canvasArea].forEach(target => {
    target.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
      dropzone.classList.add('drag-over');
    });

    target.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('drag-over');
    });

    target.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('drag-over');

      let fieldData = state.draggedField;
      if (!fieldData) {
        try {
          const raw = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('application/json');
          if (raw) fieldData = JSON.parse(raw);
        } catch (err) {}
      }

      if (fieldData) {
        createVisualFromField(fieldData);
      }
    });
  });
}

function setupMobileNavigation() {
  const navItems = document.querySelectorAll('.mobile-nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const view = item.dataset.view;
      switchMobileView(view);
    });
  });
}

function switchMobileView(viewName) {
  const ws = document.querySelector('.fabric-workspace');
  if (!ws) return;
  ws.classList.remove('is-view-canvas', 'is-view-data', 'is-view-format');
  ws.classList.add(`is-view-${viewName}`);

  document.querySelectorAll('.mobile-nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.view === viewName);
  });

  if (viewName === 'canvas') {
    setTimeout(() => {
      Object.values(state.chartInstances).forEach(c => {
        try { if (c) c.resize(); } catch (e) {}
      });
    }, 60);
  }
}

// 1. Carregar Datasets e Metadados TMDL
async function loadDatasetsAndSchemas() {
  try {
    const res = await fetch('/api/all-schemas');
    const data = await res.json();
    state.datasetsWithSchemas = data.items || [];
    dom.totalBadge.textContent = `${state.datasetsWithSchemas.length} Datasets`;
    renderDatasetsFieldsList();
  } catch (err) {
    console.error('Erro ao buscar schemas:', err);
    notify('Erro ao sincronizar com o Fabric MCP.');
  }
}

function renderDatasetsFieldsList() {
  dom.fieldsContainer.innerHTML = '';

  state.datasetsWithSchemas.forEach(item => {
    const ds = item.dataset;
    const schema = item.schema || {};
    const measures = schema.measures || [];
    const columnsByTable = schema.columnsByTable || {};

    const group = document.createElement('div');
    group.className = 'dataset-group';

    const header = document.createElement('div');
    header.className = 'dataset-group-header';
    header.innerHTML = `
      <div class="dataset-group-left">
        <div class="dataset-color-bar" style="background-color: ${ds.color || '#0078D4'};"></div>
        <div>
          <div class="dataset-header-name">${escapeHtml(ds.displayName)}</div>
          <div class="dataset-metrics-count">${measures.length} métricas &bull; ${Object.keys(columnsByTable).length} tabelas</div>
        </div>
      </div>
      <svg class="chevron-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
    `;

    const itemsContainer = document.createElement('div');
    itemsContainer.className = 'dataset-group-items';

    // Toggle accordion ao clicar no cabeçalho do dataset
    header.addEventListener('click', () => {
      const isHidden = itemsContainer.style.display === 'none';
      itemsContainer.style.display = isHidden ? 'flex' : 'none';
      const chevron = header.querySelector('.chevron-icon');
      if (chevron) {
        chevron.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(-90deg)';
      }
    });

    // Lista de Medidas (DAX)
    measures.forEach(m => {
      const fieldEl = createDraggableItem({
        datasetId: ds.id,
        workspaceId: ds.workspaceId,
        datasetName: ds.displayName,
        color: ds.color || '#0078D4',
        type: 'measure',
        table: m.table,
        name: m.measure
      });
      itemsContainer.appendChild(fieldEl);
    });

    // Lista de Colunas (Dimensões)
    for (const [tName, cols] of Object.entries(columnsByTable)) {
      if (tName.toLowerCase() === 'medidas') continue;
      cols.slice(0, 5).forEach(cName => {
        const fieldEl = createDraggableItem({
          datasetId: ds.id,
          workspaceId: ds.workspaceId,
          datasetName: ds.displayName,
          color: ds.color || '#0078D4',
          type: 'dimension',
          table: tName,
          name: cName
        });
        itemsContainer.appendChild(fieldEl);
      });
    }

    group.appendChild(header);
    group.appendChild(itemsContainer);
    dom.fieldsContainer.appendChild(group);
  });
}

function createDraggableItem(fieldData) {
  const item = document.createElement('div');
  item.className = 'field-draggable-item';
  item.setAttribute('draggable', 'true');

  const badgeClass = fieldData.type === 'measure' ? 'badge-measure' : 'badge-dim';
  const badgeLabel = fieldData.type === 'measure' ? 'DAX' : 'COL';

  item.innerHTML = `
    <div class="field-name-wrap">
      <span class="drag-grip">
        <svg width="10" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="8" cy="4" r="2"></circle><circle cx="16" cy="4" r="2"></circle><circle cx="8" cy="12" r="2"></circle><circle cx="16" cy="12" r="2"></circle><circle cx="8" cy="20" r="2"></circle><circle cx="16" cy="20" r="2"></circle></svg>
      </span>
      <span style="font-weight:500;">${escapeHtml(fieldData.name)}</span>
    </div>
    <div style="display:flex; align-items:center; gap:4px;">
      <span class="field-badge-type ${badgeClass}">${badgeLabel}</span>
      <button class="btn-quick-add" title="Adicionar diretamente à tela">+</button>
    </div>
  `;

  item.addEventListener('dragstart', (e) => {
    state.draggedField = fieldData;
    const jsonStr = JSON.stringify(fieldData);
    e.dataTransfer.setData('text/plain', jsonStr);
    e.dataTransfer.setData('application/json', jsonStr);
    e.dataTransfer.effectAllowed = 'copy';
  });

  item.addEventListener('dragend', () => {
    state.draggedField = null;
  });

  item.querySelector('.btn-quick-add').addEventListener('click', (e) => {
    e.stopPropagation();
    createVisualFromField(fieldData);
  });

  return item;
}

// 2. Manipulação de Páginas e Estados Salvos
async function loadPagesState() {
  try {
    const res = await fetch('/api/pages');
    const data = await res.json();
    state.pages = data.pages || [];
    if (state.pages.length === 0) {
      state.pages = [{ id: 'p1', name: 'Visão Executiva Geral', visuals: [] }];
    }
    state.activePageIndex = 0;
    renderPageTabs();
    renderActivePageVisuals();
  } catch (err) {
    console.error('Erro ao carregar páginas:', err);
  }
}

function renderPageTabs() {
  dom.pageTabs.innerHTML = '';
  state.pages.forEach((page, idx) => {
    const tab = document.createElement('button');
    const isActive = idx === state.activePageIndex;
    tab.className = `page-tab-item ${isActive ? 'active' : ''}`;
    tab.textContent = page.name || `Página ${idx + 1}`;
    tab.addEventListener('click', () => switchPage(idx));
    dom.pageTabs.appendChild(tab);
  });

  const activePage = state.pages[state.activePageIndex];
  if (activePage) {
    dom.inpActivePageName.value = activePage.name;
  }
}

function switchPage(index) {
  if (index < 0 || index >= state.pages.length) return;
  state.activePageIndex = index;
  selectVisualForCustomization(null);
  renderPageTabs();
  renderActivePageVisuals();
}

function addNewPage() {
  const newNum = state.pages.length + 1;
  state.pages.push({
    id: `page_${Date.now()}`,
    name: `Página ${newNum}`,
    visuals: []
  });
  switchPage(state.pages.length - 1);
  notify(`Página ${newNum} criada.`);
}

function deleteActivePage() {
  if (state.pages.length <= 1) {
    alert('O relatório precisa ter pelo menos 1 página.');
    return;
  }
  const currName = state.pages[state.activePageIndex].name;
  if (confirm(`Deseja realmente excluir a "${currName}"?`)) {
    state.pages.splice(state.activePageIndex, 1);
    state.activePageIndex = Math.max(0, state.activePageIndex - 1);
    selectVisualForCustomization(null);
    renderPageTabs();
    renderActivePageVisuals();
    notify('Página removida.');
  }
}

async function savePagesToServer() {
  try {
    const res = await fetch('/api/pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pages: state.pages })
    });
    const result = await res.json();
    if (result.success) {
      notify('Estrutura de páginas e visuais salva com sucesso.');
    }
  } catch (err) {
    notify('Erro ao salvar páginas no servidor.');
  }
}

// 3. Adicionar Visual a partir de um Campo
function createVisualFromField(field) {
  const activePage = state.pages[state.activePageIndex];
  if (!activePage) return;

  const visualId = `vis_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const vType = state.defaultVisualType || 'kpi';

  let metricVal = '14.820';
  if (field.name.toLowerCase().includes('faturamento') || field.name.toLowerCase().includes('valor')) {
    metricVal = 'R$ 1.842.500';
  } else if (field.name.toLowerCase().includes('meta')) {
    metricVal = '94.5%';
  } else if (field.name.toLowerCase().includes('dia')) {
    metricVal = '9,4 / dia';
  } else if (field.name.toLowerCase().includes('acidentes') || field.name.toLowerCase().includes('atendimento')) {
    metricVal = '3.421';
  }

  const newVisual = {
    id: visualId,
    visualType: vType,
    datasetId: field.datasetId,
    workspaceId: field.workspaceId,
    datasetName: field.datasetName,
    color: field.color || '#0078D4',
    table: field.table,
    measure: field.type === 'measure' ? field.name : null,
    dimension: field.type === 'dimension' ? field.name : null,
    title: field.name,
    value: metricVal,
    colSpan: vType === 'kpi' ? 3 : (vType === 'table' ? 12 : 6)
  };

  activePage.visuals.push(newVisual);
  appendSingleVisualCard(newVisual);
  selectVisualForCustomization(newVisual);
  notify(`Visual criado a partir de [${field.name}].`);

  if (window.innerWidth <= 900) {
    switchMobileView('canvas');
    setTimeout(() => {
      const newCard = document.getElementById(`card_${visualId}`);
      if (newCard) newCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
  }
}

// 4. Renderizar Visuais da Página Ativa
function renderActivePageVisuals() {
  Object.values(state.chartInstances).forEach(c => {
    try { if (c) c.destroy(); } catch (e) {}
  });
  state.chartInstances = {};

  dom.grid.innerHTML = '';
  const activePage = state.pages[state.activePageIndex];
  if (!activePage || activePage.visuals.length === 0) {
    return;
  }

  activePage.visuals.forEach(v => {
    appendSingleVisualCard(v);
  });
}

function appendSingleVisualCard(v) {
  const activePage = state.pages[state.activePageIndex];
  const card = document.createElement('div');
  card.id = `card_${v.id}`;
  const isSelected = state.selectedVisualId === v.id;
  const colClass = `visual-col-${v.colSpan || (v.visualType === 'kpi' ? 3 : 6)}`;
  card.className = `visual-card-canvas ${colClass} ${isSelected ? 'selected-visual' : ''}`;
  card.style.borderTop = `3px solid ${v.color || '#3B82F6'}`;

  card.innerHTML = `
    <div class="visual-card-top">
      <div style="display:flex; align-items:center; gap:8px; overflow:hidden;">
        <span style="font-size:10px; font-weight:700; text-transform:uppercase; padding:3px 7px; border-radius:6px; background:${v.color || '#3B82F6'}15; color:${v.color || '#3B82F6'}; flex-shrink:0;">
          ${escapeHtml(v.datasetName || 'Dataset')}
        </span>
        <span class="visual-card-title">${escapeHtml(v.title || v.measure || v.dimension)}</span>
      </div>
      <div class="visual-card-actions">
        <select class="visual-type-select" data-id="${v.id}">
          <option value="kpi" ${v.visualType === 'kpi' ? 'selected' : ''}>Cartão KPI</option>
          <option value="bar" ${v.visualType === 'bar' ? 'selected' : ''}>Barras</option>
          <option value="line" ${v.visualType === 'line' ? 'selected' : ''}>Linhas</option>
          <option value="donut" ${v.visualType === 'donut' ? 'selected' : ''}>Rosca</option>
          <option value="area" ${v.visualType === 'area' ? 'selected' : ''}>Área</option>
          <option value="table" ${v.visualType === 'table' ? 'selected' : ''}>Tabela</option>
        </select>
        <button class="btn-icon" data-id="${v.id}" title="Excluir visual">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
    </div>
    <div class="visual-card-body-content" id="body_${v.id}"></div>
  `;

  // Clique no card para selecionar e abrir o painel de personalização
  card.addEventListener('click', (e) => {
    if (e.target.tagName !== 'SELECT' && !e.target.closest('.btn-icon')) {
      selectVisualForCustomization(v);
    }
  });

  // Handler de exclusão cirúrgico
  card.querySelector('.btn-icon').addEventListener('click', (e) => {
    e.stopPropagation();
    if (state.chartInstances[v.id]) {
      try { state.chartInstances[v.id].destroy(); } catch (e) {}
      delete state.chartInstances[v.id];
    }
    activePage.visuals = activePage.visuals.filter(x => x.id !== v.id);
    card.remove();
    if (state.selectedVisualId === v.id) {
      selectVisualForCustomization(null);
    }
    notify('Visual removido.');
  });

  // Handler de alteração dinâmica do tipo de visual cirúrgico
  card.querySelector('.visual-type-select').addEventListener('change', (e) => {
    e.stopPropagation();
    const newType = e.target.value;
    v.visualType = newType;
    v.colSpan = newType === 'kpi' ? 3 : (newType === 'table' ? 12 : 6);

    const isSel = state.selectedVisualId === v.id;
    card.className = `visual-card-canvas visual-col-${v.colSpan} ${isSel ? 'selected-visual' : ''}`;

    if (state.chartInstances[v.id]) {
      try { state.chartInstances[v.id].destroy(); } catch (e) {}
      delete state.chartInstances[v.id];
    }

    renderVisualContent(v);
    if (isSel) selectVisualForCustomization(v);
  });

  dom.grid.appendChild(card);
  renderVisualContent(v);
}

function renderVisualContent(v) {
  const bodyEl = document.getElementById(`body_${v.id}`);
  if (!bodyEl) return;

  if (v.visualType === 'kpi') {
    const val = v.value || '14.820';
    const isPositive = !val.includes('-') && !val.includes('0,0%');
    const badgeText = isPositive ? '+16.36%' : '-3.21%';
    const badgeClass = isPositive ? 'trend-badge-positive' : 'trend-badge-negative';
    const arrow = isPositive ? '↗' : '↘';

    bodyEl.innerHTML = `
      <div class="kpi-modern-wrapper">
        <div class="kpi-info-col">
          <div class="kpi-big-value">${val}</div>
          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            <span class="kpi-trend-pill ${badgeClass}">${arrow} ${badgeText}</span>
            <span class="kpi-sub-text">vs. mês anterior</span>
          </div>
        </div>
        <div class="kpi-sparkline-box">
          <canvas id="spark_${v.id}" class="kpi-sparkline-canvas"></canvas>
        </div>
      </div>
    `;

    setTimeout(() => {
      initSparklineForKpi(v, isPositive);
    }, 20);

  } else if (v.visualType === 'table') {
    bodyEl.innerHTML = `
      <div class="table-container-modern">
        <table class="saas-modern-table">
          <thead>
            <tr>
              <th>Entidade / Item</th>
              <th>Categoria</th>
              <th>Status</th>
              <th style="text-align:right;">${escapeHtml(v.measure || 'Total')}</th>
              <th style="text-align:right;">% Part.</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <div class="table-cell-avatar-wrap">
                  <div class="table-avatar" style="background: #EEF2FF; color:#4F46E5;">AD</div>
                  <span style="font-weight:600;">Anthony Dawson</span>
                </div>
              </td>
              <td><span style="color:var(--fabric-text-secondary); font-size:12px;">Vendas Corporativas</span></td>
              <td><span class="status-badge-pill status-delivered">Entregue</span></td>
              <td style="text-align:right; font-weight:700;">R$ 48.920</td>
              <td style="text-align:right; color:var(--fabric-text-secondary);">38.2%</td>
            </tr>
            <tr>
              <td>
                <div class="table-cell-avatar-wrap">
                  <div class="table-avatar" style="background: #ECFDF5; color:#059669;">BH</div>
                  <span style="font-weight:600;">Bethany Hamilton</span>
                </div>
              </td>
              <td><span style="color:var(--fabric-text-secondary); font-size:12px;">Serviços TI</span></td>
              <td><span class="status-badge-pill status-pending">Pendente</span></td>
              <td style="text-align:right; font-weight:700;">R$ 32.400</td>
              <td style="text-align:right; color:var(--fabric-text-secondary);">25.3%</td>
            </tr>
            <tr>
              <td>
                <div class="table-cell-avatar-wrap">
                  <div class="table-avatar" style="background: #FEF2F2; color:#DC2626;">MM</div>
                  <span style="font-weight:600;">Mafalda Matias</span>
                </div>
              </td>
              <td><span style="color:var(--fabric-text-secondary); font-size:12px;">Operações</span></td>
              <td><span class="status-badge-pill status-cancelled">Cancelado</span></td>
              <td style="text-align:right; font-weight:700;">R$ 18.150</td>
              <td style="text-align:right; color:var(--fabric-text-secondary);">14.2%</td>
            </tr>
            <tr>
              <td>
                <div class="table-cell-avatar-wrap">
                  <div class="table-avatar" style="background: #FFFBEB; color:#D97706;">FM</div>
                  <span style="font-weight:600;">Freddie Mercury</span>
                </div>
              </td>
              <td><span style="color:var(--fabric-text-secondary); font-size:12px;">Consultoria</span></td>
              <td><span class="status-badge-pill status-delivered">Entregue</span></td>
              <td style="text-align:right; font-weight:700;">R$ 28.530</td>
              <td style="text-align:right; color:var(--fabric-text-secondary);">22.3%</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  } else {
    bodyEl.innerHTML = `<div class="visual-chart-body"><canvas id="canvas_${v.id}"></canvas></div>`;
    setTimeout(() => {
      initChartForVisual(v);
    }, 20);
  }
}

function initSparklineForKpi(v, isPositive) {
  const cvs = document.getElementById(`spark_${v.id}`);
  if (!cvs) return;

  const sparkColor = isPositive ? '#10B981' : '#EF4444';
  const sparkData = isPositive 
    ? [20, 28, 22, 38, 30, 42, 39, 54, 48, 62] 
    : [60, 52, 58, 44, 46, 38, 40, 31, 28, 22];

  try {
    new Chart(cvs, {
      type: 'line',
      data: {
        labels: sparkData.map((_, i) => i),
        datasets: [{
          data: sparkData,
          borderColor: sparkColor,
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.45,
          fill: true,
          backgroundColor: (context) => {
            const chart = context.chart;
            const { ctx, chartArea } = chart;
            if (!chartArea) return 'transparent';
            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, `${sparkColor}35`);
            gradient.addColorStop(1, `${sparkColor}00`);
            return gradient;
          }
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: { display: false },
          y: { display: false }
        },
        elements: { line: { capBezierPoints: true } }
      }
    });
  } catch (err) {
    console.warn('Sparkline error:', err);
  }
}

function initChartForVisual(v) {
  const cvs = document.getElementById(`canvas_${v.id}`);
  if (!cvs) return;

  if (state.chartInstances[v.id]) {
    try { state.chartInstances[v.id].destroy(); } catch (e) {}
  }

  const isDark = state.theme === 'dark';
  const textColor = isDark ? '#94A3B8' : '#64748B';
  const gridColor = isDark ? '#334155' : '#F1F5F9';

  const baseColor = v.color || '#3B82F6';
  let chartType = v.visualType;
  let isArea = false;
  if (chartType === 'area') {
    chartType = 'line';
    isArea = true;
  }

  let labels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago'];
  let dataVals = [140, 185, 172, 240, 225, 290, 270, 340];

  if (v.datasetId && v.datasetId.startsWith('1a74')) {
    labels = ['Boa Viagem', 'Santo Amaro', 'Afogados', 'Madalena', 'Derby', 'Espinheiro', 'Casa Forte'];
    dataVals = [420, 310, 290, 240, 215, 180, 145];
  }

  const modernPalette = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4'];

  const dsConfig = {
    label: v.measure || v.title,
    data: chartType === 'donut' ? [45, 28, 17, 10] : dataVals,
    backgroundColor: chartType === 'donut' 
      ? modernPalette.slice(0, 4) 
      : (isArea ? (context) => {
          const chart = context.chart;
          const { ctx, chartArea } = chart;
          if (!chartArea) return `${baseColor}25`;
          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, `${baseColor}40`);
          gradient.addColorStop(1, `${baseColor}02`);
          return gradient;
        } : baseColor),
    borderColor: chartType === 'donut' ? (isDark ? '#1E293B' : '#FFFFFF') : baseColor,
    borderWidth: chartType === 'donut' ? 3 : 2.5,
    fill: isArea,
    tension: 0.42,
    borderRadius: chartType === 'bar' ? 6 : 0,
    pointBackgroundColor: baseColor,
    pointBorderColor: '#FFFFFF',
    pointHoverRadius: 6,
    pointRadius: chartType === 'line' || isArea ? 3 : 0
  };

  try {
    state.chartInstances[v.id] = new Chart(cvs, {
      type: chartType,
      data: {
        labels: chartType === 'donut' ? ['Mobile', 'Desktop', 'Tablet', 'Outros'] : labels,
        datasets: [dsConfig]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: chartType === 'donut' ? '76%' : 0,
        plugins: {
          legend: {
            display: chartType === 'donut',
            position: 'bottom',
            labels: { 
              boxWidth: 10, 
              boxHeight: 10,
              usePointStyle: true,
              pointStyle: 'circle',
              font: { family: "'Plus Jakarta Sans', sans-serif", size: 11, weight: '500' }, 
              color: textColor,
              padding: 14
            }
          },
          tooltip: {
            backgroundColor: isDark ? '#1E293B' : '#0F172A',
            titleFont: { family: "'Plus Jakarta Sans', sans-serif", size: 12, weight: '600' },
            bodyFont: { family: "'Plus Jakarta Sans', sans-serif", size: 12 },
            padding: 10,
            cornerRadius: 8
          }
        },
        scales: chartType === 'donut' ? {} : {
          x: { 
            grid: { display: false }, 
            ticks: { color: textColor, font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 } } 
          },
          y: { 
            grid: { color: gridColor, drawBorder: false }, 
            ticks: { color: textColor, font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 } } 
          }
        }
      }
    });
  } catch (err) {
    console.error('Erro ao renderizar chart:', err);
  }
}

// 5. Exibir Definição PBIR Multi-Páginas
function showPBIRDefinition() {
  const pbir = {
    $schema: "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/1.0.0/schema.json",
    theme: state.theme === 'dark' ? "Fabric Dark Modern" : "Fabric Modern Clean",
    reportApp: "Executive Multi-Page Fabric Studio",
    pages: state.pages.map(p => ({
      id: p.id,
      name: p.name,
      visualsCount: p.visuals.length,
      visuals: p.visuals.map(v => ({
        id: v.id,
        type: v.visualType,
        dataset: v.datasetName,
        title: v.title || v.measure,
        color: v.color,
        colSpan: v.colSpan,
        daxExpression: `[${v.table}].[${v.measure || v.dimension}]`
      }))
    }))
  };

  dom.defJsonView.textContent = JSON.stringify(pbir, null, 2);
  dom.modalDef.classList.add('open');
}

// 6. Exportar Relatório via Orquestrador & Report Builder Agent
async function exportFabricReport() {
  notify('Gerando relatório completo multi-páginas via Report Builder Agent...');
  try {
    const res = await fetch('/api/generate-mega-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reportTitle: "Power Embedded APPS - Multi-Page App",
        theme: state.theme === 'dark' ? "Fabric Dark Modern" : "Fabric Modern Clean",
        pages: state.pages
      })
    });
    const result = await res.json();
    if (result.success) {
      notify(`App publicado em reports_output/${result.fileName}!`);
    }
  } catch (err) {
    notify('Erro ao gerar relatório final.');
  }
}

async function handleSaveDataset() {
  const name = dom.inpName.value.trim();
  const wid = dom.inpWid.value.trim();
  const id = dom.inpId.value.trim();
  const desc = dom.inpDesc.value.trim();

  if (!wid || !id) {
    alert('Informe o Workspace ID e o Semantic Model ID.');
    return;
  }

  try {
    const res = await fetch('/api/datasets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: name, workspaceId: wid, datasetId: id, description: desc })
    });
    const data = await res.json();
    if (data.success) {
      dom.modalAdd.classList.remove('open');
      dom.inpName.value = '';
      dom.inpId.value = '';
      dom.inpDesc.value = '';
      notify('Novo dataset adicionado com sucesso!');
      await loadDatasetsAndSchemas();
    }
  } catch (err) {
    alert('Erro ao registrar novo dataset.');
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ==========================================
// FUNÇÕES DE GERENCIAMENTO DE TEMPLATES
// ==========================================

function exportTemplateAsFile() {
  const templateData = {
    schemaVersion: "1.0-fabric-metadata-template",
    name: "Template Exportado " + new Date().toLocaleDateString('pt-BR'),
    description: "Template de layout corporativo reutilizável (Live Connection)",
    createdAt: new Date().toISOString(),
    theme: state.theme,
    pages: state.pages
  };

  const jsonStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(templateData, null, 2));
  const dlAnchor = document.createElement('a');
  dlAnchor.setAttribute("href", jsonStr);
  dlAnchor.setAttribute("download", `relatorio_template_${Date.now()}.json`);
  document.body.appendChild(dlAnchor);
  dlAnchor.click();
  dlAnchor.remove();

  notify('Arquivo de template baixado com sucesso!');
}

async function loadTemplatesList() {
  dom.templatesListContainer.innerHTML = '<div style="font-size:12px; color:var(--fabric-text-secondary); padding:8px;">Carregando templates...</div>';
  try {
    const res = await fetch('/api/templates');
    const data = await res.json();
    const templates = data.templates || [];

    if (templates.length === 0) {
      dom.templatesListContainer.innerHTML = '<div style="font-size:12px; color:var(--fabric-text-secondary); padding:8px;">Nenhum template salvo no servidor ainda.</div>';
      return;
    }

    dom.templatesListContainer.innerHTML = '';
    templates.forEach(t => {
      const item = document.createElement('div');
      item.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:8px 10px; background:var(--fabric-neutral-lighter); border:1px solid var(--fabric-border); border-radius:4px;';
      item.innerHTML = `
        <div>
          <div style="font-weight:600; font-size:12px; color:var(--fabric-text-primary);">${escapeHtml(t.templateName)}</div>
          <div style="font-size:11px; color:var(--fabric-text-tertiary);">${t.totalPages} páginas &bull; ${escapeHtml(t.fileName)}</div>
        </div>
        <button class="btn-fluent btn-primary" style="font-size:11px; padding:4px 10px;" data-fname="${escapeHtml(t.fileName)}">
          Carregar
        </button>
      `;

      item.querySelector('button').addEventListener('click', () => loadTemplateFromServer(t.fileName));
      dom.templatesListContainer.appendChild(item);
    });
  } catch (err) {
    dom.templatesListContainer.innerHTML = '<div style="font-size:12px; color:#A80000; padding:8px;">Erro ao carregar lista de templates.</div>';
  }
}

async function saveCurrentAsTemplate() {
  const name = dom.inpSaveTemplateName.value.trim() || 'Template ' + (new Date().toLocaleDateString('pt-BR'));
  try {
    const res = await fetch('/api/templates/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name,
        theme: state.theme,
        pages: state.pages
      })
    });
    const result = await res.json();
    if (result.success) {
      notify(`Template "${name}" salvo no servidor!`);
      dom.inpSaveTemplateName.value = '';
      await loadTemplatesList();
    }
  } catch (err) {
    notify('Erro ao salvar template.');
  }
}

async function loadTemplateFromServer(fileName) {
  try {
    const res = await fetch('/api/templates/load', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: fileName, applyNow: true })
    });
    const result = await res.json();
    if (result.success && result.template) {
      applyTemplateData(result.template);
      dom.modalTemplates.classList.remove('open');
      notify(`Template "${result.template.name}" aplicado com sucesso!`);
    }
  } catch (err) {
    notify('Erro ao aplicar template selecionado.');
  }
}

function handleImportTemplateFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const templateData = JSON.parse(event.target.result);
      if (!templateData.pages || !Array.isArray(templateData.pages)) {
        alert('Arquivo de template inválido: metadados de páginas não encontrados.');
        return;
      }
      applyTemplateData(templateData);
      dom.modalTemplates.classList.remove('open');
      notify(`Template importado com sucesso: ${templateData.name || file.name}!`);
    } catch (err) {
      alert('Erro ao processar arquivo JSON de template.');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function applyTemplateData(templateData) {
  if (templateData.pages && templateData.pages.length > 0) {
    state.pages = templateData.pages;
    state.activePageIndex = 0;
    if (templateData.theme) {
      setTheme(templateData.theme);
    }
    renderPageTabs();
    renderActivePageVisuals();
    savePagesToServer();
  }
}

// ==========================================
// FUNÇÕES DE ATUALIZAÇÃO / REFRESH
// ==========================================

function refreshVisualsOnly() {
  const icon = dom.btnRefreshMenu.querySelector('.icon-svg');
  if (icon) icon.classList.add('spinning');
  notify('Atualizando visuais da página ativa...');

  setTimeout(() => {
    // Redesenha todos os visuais da página sem perder configurações
    renderActivePageVisuals();
    if (icon) icon.classList.remove('spinning');
    notify('Visuais da página atualizados com sucesso!');
  }, 400);
}

async function refreshSemanticModelsOnly() {
  const icon = dom.btnRefreshMenu.querySelector('.icon-svg');
  const quickIcon = dom.btnQuickRefreshSchemas ? dom.btnQuickRefreshSchemas.querySelector('svg') : null;
  if (icon) icon.classList.add('spinning');
  if (quickIcon) quickIcon.classList.add('spinning');

  notify('Sincronizando modelos semânticos via Fabric MCP...');

  try {
    const res = await fetch('/api/refresh-schemas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const data = await res.json();
    if (data.success && data.items) {
      state.datasetsWithSchemas = data.items;
      dom.totalBadge.textContent = `${state.datasetsWithSchemas.length} Datasets`;
      renderDatasetsFieldsList();
      notify('Modelos semânticos (TMDL) sincronizados com sucesso!');
    } else {
      notify('Aviso: Schemas recarregados com dados locais.');
      await loadDatasetsAndSchemas();
    }
  } catch (err) {
    console.error('Erro ao atualizar modelos:', err);
    notify('Erro ao sincronizar com o Fabric.');
  } finally {
    if (icon) icon.classList.remove('spinning');
    if (quickIcon) quickIcon.classList.remove('spinning');
  }
}

async function refreshAllDashboard() {
  const icon = dom.btnRefreshMenu.querySelector('.icon-svg');
  if (icon) icon.classList.add('spinning');
  notify('Executando atualização completa (Modelos + Visuais)...');

  try {
    await refreshSemanticModelsOnly();
    renderActivePageVisuals();
    notify('Atualização completa finalizada com sucesso!');
  } catch (err) {
    notify('Erro durante a atualização completa.');
  } finally {
    if (icon) icon.classList.remove('spinning');
  }
}
