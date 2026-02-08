/**
 * IC Chip Data Structure Analyzer
 * 犯罪収益移転防止法対応 - 本人確認書類ICチップ データ構造アナライザー
 */

const App = {
  data: {},
  index: null,
  currentDoc: null,
  currentTab: 'structure',
  viewMode: 'detail', // 'detail' or 'compare'

  async init() {
    try {
      const res = await fetch('data/index.json');
      this.index = await res.json();
      await this.loadAllData();
      this.renderSidebar();
      this.renderWelcome();
      this.bindEvents();
    } catch (e) {
      console.error('Initialization error:', e);
      document.getElementById('main-content').innerHTML =
        '<div class="welcome"><h2>Error</h2><p>データの読み込みに失敗しました。ローカルサーバーで実行してください。<br><code>npx serve .</code></p></div>';
    }
  },

  async loadAllData() {
    const promises = this.index.documents.map(async (doc) => {
      const res = await fetch(`data/${doc.file}`);
      this.data[doc.id] = await res.json();
    });
    await Promise.all(promises);
  },

  bindEvents() {
    document.getElementById('search-input').addEventListener('input', (e) => {
      this.filterSidebar(e.target.value);
    });
    document.getElementById('btn-compare').addEventListener('click', () => {
      this.toggleCompareMode();
    });
  },

  filterSidebar(query) {
    const items = document.querySelectorAll('.doc-item');
    const q = query.toLowerCase();
    items.forEach(item => {
      const name = item.dataset.name.toLowerCase();
      const nameEn = (item.dataset.nameEn || '').toLowerCase();
      item.style.display = (name.includes(q) || nameEn.includes(q)) ? '' : 'none';
    });
  },

  renderSidebar() {
    const container = document.getElementById('doc-list');
    const categories = {};
    this.index.documents.forEach(doc => {
      const cat = doc.category;
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(doc);
    });

    let html = '';
    for (const [catKey, docs] of Object.entries(categories)) {
      const catName = this.index.categories[catKey] || catKey;
      html += `<div class="sidebar-section">
        <div class="sidebar-section-title">${catName}</div>
        <ul class="doc-list">`;
      docs.forEach(doc => {
        const data = this.data[doc.id];
        const plannedBadge = doc.category === 'planned'
          ? `<span class="planned-badge">予定</span>` : '';
        html += `<li class="doc-item" data-id="${doc.id}" data-name="${doc.name}" data-name-en="${data?.nameEn || ''}" onclick="App.selectDoc('${doc.id}')">
          <span class="doc-icon">${this.getIcon(doc.icon)}</span>
          <div>
            <div class="doc-name">${doc.name}</div>
            <div class="doc-name-en">${data?.nameEn || ''}</div>
          </div>
          ${plannedBadge}
        </li>`;
      });
      html += '</ul></div>';
    }
    container.innerHTML = html;
  },

  getIcon(iconName) {
    const icons = {
      credit_card: '\uD83D\uDCB3',
      directions_car: '\uD83D\uDE97',
      flight_land: '\u2708\uFE0F',
      menu_book: '\uD83D\uDCD5',
      home: '\uD83C\uDFE0',
      update: '\uD83D\uDD04'
    };
    return icons[iconName] || '\uD83D\uDCCB';
  },

  selectDoc(docId) {
    this.currentDoc = docId;
    this.viewMode = 'detail';
    document.querySelectorAll('.doc-item').forEach(el => el.classList.remove('active'));
    document.querySelector(`.doc-item[data-id="${docId}"]`)?.classList.add('active');
    document.getElementById('btn-compare').classList.remove('btn-active');
    this.renderDetail();
  },

  renderWelcome() {
    const main = document.getElementById('main-content');
    main.innerHTML = `
      <div class="welcome">
        <h2>IC Chip Data Structure Analyzer</h2>
        <p>犯罪収益移転防止法対応のための本人確認書類ICチップデータ構造リファレンスツールです。</p>
        <p style="margin-top:12px;">左のサイドバーから確認したい書類を選択してください。「比較」ボタンで書類間のデータ構造を比較できます。</p>
        <div style="margin-top:24px; display:flex; gap:12px; flex-wrap:wrap; justify-content:center;">
          ${this.index.documents.map(d => `
            <button class="btn" onclick="App.selectDoc('${d.id}')">${this.getIcon(d.icon)} ${d.name}</button>
          `).join('')}
        </div>
      </div>`;
  },

  renderDetail() {
    const doc = this.data[this.currentDoc];
    if (!doc) return;
    const main = document.getElementById('main-content');

    const disclaimer = doc.status === 'planned'
      ? `<div class="disclaimer">${doc.metadata?.disclaimer || '本情報は検討段階の内容を含みます。正式仕様は変更される可能性があります。'}</div>` : '';

    main.innerHTML = `
      ${disclaimer}
      <div class="overview">${this.renderOverview(doc)}</div>
      <div class="tabs">
        <div class="tab ${this.currentTab === 'structure' ? 'active' : ''}" onclick="App.switchTab('structure')">ファイル構造</div>
        <div class="tab ${this.currentTab === 'apdu' ? 'active' : ''}" onclick="App.switchTab('apdu')">APDUコマンド</div>
        <div class="tab ${this.currentTab === 'security' ? 'active' : ''}" onclick="App.switchTab('security')">セキュリティ</div>
        <div class="tab ${this.currentTab === 'verification' ? 'active' : ''}" onclick="App.switchTab('verification')">検証フロー</div>
      </div>
      <div id="tab-content">${this.renderTabContent(doc)}</div>`;
  },

  renderOverview(doc) {
    const items = [
      { label: '発行者', value: doc.issuer },
      { label: '通信規格', value: doc.standard?.contactless || '-' },
      { label: '暗号方式', value: doc.security?.encryption || '-' },
      { label: '法的根拠', value: `${doc.amlReference}<br><small>${doc.legalBasis}</small>` }
    ];
    return items.map(i => `
      <div class="overview-card">
        <h3>${i.label}</h3>
        <div class="value">${i.value}</div>
      </div>`).join('');
  },

  switchTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.tab:nth-child(${['structure','apdu','security','verification'].indexOf(tab)+1})`)?.classList.add('active');
    const doc = this.data[this.currentDoc];
    document.getElementById('tab-content').innerHTML = this.renderTabContent(doc);
  },

  renderTabContent(doc) {
    switch (this.currentTab) {
      case 'structure': return this.renderStructureTab(doc);
      case 'apdu': return this.renderApduTab(doc);
      case 'security': return this.renderSecurityTab(doc);
      case 'verification': return this.renderVerificationTab(doc);
      default: return '';
    }
  },

  renderStructureTab(doc) {
    if (!doc.applications) return '<p>データなし</p>';
    let html = '';
    doc.applications.forEach(app => {
      html += `<div class="tree-container" style="margin-bottom:16px;">
        <div style="margin-bottom:12px;">
          <strong style="font-size:15px;">${app.name}</strong>
          ${app.aid ? `<span style="font-size:11px;color:var(--text-muted);margin-left:8px;font-family:monospace;">AID: ${app.aid}</span>` : ''}
          <div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">${app.description || ''}</div>
          ${app.note ? `<div class="notes-box" style="margin-top:8px;"><strong>Note:</strong> ${app.note}</div>` : ''}
        </div>
        ${this.renderTreeNodes(app.dfStructure || [])}
      </div>`;
    });
    return html;
  },

  renderTreeNodes(nodes, depth = 0) {
    if (!nodes || !nodes.length) return '';
    return nodes.map(node => {
      const hasChildren = node.children && node.children.length > 0;
      const hasFields = node.fields && node.fields.length > 0;
      const expandable = hasChildren || hasFields;
      const nodeId = `node-${Math.random().toString(36).substr(2, 9)}`;
      const typeBadgeClass = this.getTypeBadgeClass(node.type);
      const idText = [node.efid, node.shortEfid, node.aid].filter(Boolean).map((v, i) => {
        const labels = ['EF-ID', 'Short', 'AID'];
        return `${labels[i]}:${v}`;
      }).join(' | ');

      const accessBadge = node.accessCondition ? this.getAccessBadge(node.accessCondition) : '';

      return `
        <div class="tree-node">
          <div class="tree-node-header" onclick="App.toggleNode('${nodeId}')">
            <span class="tree-toggle ${expandable ? '' : 'empty'}" id="toggle-${nodeId}">\u25B6</span>
            <span class="tree-type-badge ${typeBadgeClass}">${node.type || 'DF'}</span>
            <span class="tree-node-name">${node.name}</span>
            ${accessBadge}
            <span class="tree-node-id">${idText}</span>
          </div>
          <div class="tree-node-children" id="children-${nodeId}" style="display:none;">
            ${node.description ? `<div class="field-detail-desc" style="margin-left:24px;padding:4px 0;font-size:12px;color:var(--text-secondary);">${node.description}</div>` : ''}
            ${node.dataFormat ? `<div style="margin-left:24px;padding:2px 0;font-size:11px;color:var(--accent-purple);">Format: ${node.dataFormat}</div>` : ''}
            ${hasFields ? this.renderFieldTable(node.fields) : ''}
            ${hasChildren ? this.renderTreeNodes(node.children, depth + 1) : ''}
          </div>
        </div>`;
    }).join('');
  },

  getTypeBadgeClass(type) {
    if (!type) return 'df';
    const t = type.toLowerCase();
    if (t.includes('(') && t.includes('\u5185\u90E8')) return 'ef-internal';
    if (t === 'ef') return 'ef';
    if (t === 'df') return 'df';
    return 'ef';
  },

  getAccessBadge(cond) {
    const c = cond.toLowerCase();
    if (c.includes('pin') || c.includes('\u6697\u8A3C\u756A\u53F7')) {
      return '<span class="info-badge pin">PIN</span>';
    }
    if (c.includes('bac')) {
      return '<span class="info-badge bac">BAC</span>';
    }
    if (c.includes('\u4E0D\u8981') || c.includes('free')) {
      return '<span class="info-badge free">Free</span>';
    }
    return '<span class="info-badge pin">Auth</span>';
  },

  toggleNode(nodeId) {
    const children = document.getElementById(`children-${nodeId}`);
    const toggle = document.getElementById(`toggle-${nodeId}`);
    if (!children) return;
    const isVisible = children.style.display !== 'none';
    children.style.display = isVisible ? 'none' : '';
    toggle.classList.toggle('expanded', !isVisible);
  },

  renderFieldTable(fields) {
    if (!fields || !fields.length) return '';
    let html = `<div class="field-detail"><table class="field-table">
      <thead><tr>
        <th>Name</th><th>Tag</th><th>Length</th><th>Encoding</th><th>Description</th>
      </tr></thead><tbody>`;
    fields.forEach(f => {
      const subFields = f.subFields
        ? `<br><span style="font-size:10px;color:var(--text-muted);">[${f.subFields.join(', ')}]</span>` : '';
      html += `<tr>
        <td>${f.name}</td>
        <td class="tag-cell">${f.tag || '-'}</td>
        <td>${f.length || '-'}</td>
        <td class="encoding-cell">${f.encoding || '-'}</td>
        <td>${f.description || ''}${subFields}</td>
      </tr>`;
    });
    html += '</tbody></table></div>';
    return html;
  },

  renderApduTab(doc) {
    if (!doc.apduCommands || !doc.apduCommands.length) return '<p>APDUコマンド情報なし</p>';
    let html = '<div class="apdu-table-container"><table class="apdu-table">';
    html += '<thead><tr><th>Name</th><th>Command (Hex)</th><th>Description</th></tr></thead><tbody>';
    doc.apduCommands.forEach(cmd => {
      html += `<tr>
        <td><strong>${cmd.name}</strong></td>
        <td class="cmd-cell">${cmd.command}</td>
        <td style="color:var(--text-secondary)">${cmd.description}</td>
      </tr>`;
    });
    html += '</tbody></table></div>';
    return html;
  },

  renderSecurityTab(doc) {
    if (!doc.security) return '<p>セキュリティ情報なし</p>';
    const sec = doc.security;
    let html = '<div class="security-grid">';

    if (sec.accessControl) {
      sec.accessControl.forEach(ac => {
        html += `<div class="security-card">
          <h4><span class="security-icon">\uD83D\uDD12</span>${ac.name}</h4>
          <p>${ac.description}</p>
          ${ac.types ? '<ul>' + ac.types.map(t => `<li><strong>${t.name}</strong>: ${t.format || ''} ${t.retryLimit ? `(${t.retryLimit}\u56DE\u3067\u30ED\u30C3\u30AF)` : ''} ${t.description || ''}</li>`).join('') + '</ul>' : ''}
          ${ac.derivation ? `<p style="margin-top:8px;font-size:12px;"><strong>\u9375\u5C0E\u51FA:</strong> ${ac.derivation}</p>` : ''}
          ${ac.method ? `<p style="margin-top:8px;font-size:12px;"><strong>\u65B9\u5F0F:</strong> ${ac.method}</p>` : ''}
        </div>`;
      });
    }

    html += `<div class="security-card">
      <h4><span class="security-icon">\uD83D\uDD10</span>暗号方式</h4>
      <p>${sec.encryption || '-'}</p>
      ${sec.secureMessaging ? `<p style="margin-top:8px;font-size:12px;"><strong>Secure Messaging:</strong> ${sec.secureMessaging}</p>` : ''}
    </div>`;

    html += '</div>';
    return html;
  },

  renderVerificationTab(doc) {
    if (!doc.verification) return '<p>検証フロー情報なし</p>';
    const v = doc.verification;
    let html = `<div class="verification-flow">
      <div style="margin-bottom:16px;">
        <strong style="font-size:15px;">${v.method}</strong>
        <div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">Provider: ${v.provider}</div>
      </div>`;

    if (v.process) {
      v.process.forEach((step, i) => {
        const text = step.replace(/^\d+\.\s*/, '');
        html += `<div class="verification-step">
          <div class="step-number">${i + 1}</div>
          <div class="step-text">${text}</div>
        </div>`;
      });
    }

    if (v.notes) {
      html += `<div class="notes-box" style="margin-top:16px;"><strong>Note:</strong> ${v.notes}</div>`;
    }
    if (v.ocsp) {
      html += `<div style="margin-top:12px;font-size:12px;color:var(--text-secondary);"><strong>OCSP:</strong> <code>${v.ocsp}</code></div>`;
    }
    if (v.onlineCheck) {
      html += `<div style="margin-top:8px;font-size:12px;color:var(--text-secondary);"><strong>Online Check:</strong> ${v.onlineCheck}</div>`;
    }

    html += '</div>';
    return html;
  },

  toggleCompareMode() {
    if (this.viewMode === 'compare') {
      this.viewMode = 'detail';
      document.getElementById('btn-compare').classList.remove('btn-active');
      if (this.currentDoc) {
        this.renderDetail();
      } else {
        this.renderWelcome();
      }
    } else {
      this.viewMode = 'compare';
      document.getElementById('btn-compare').classList.add('btn-active');
      document.querySelectorAll('.doc-item').forEach(el => el.classList.remove('active'));
      this.renderComparison();
    }
  },

  renderComparison() {
    const main = document.getElementById('main-content');
    const docs = this.index.documents.map(d => this.data[d.id]).filter(Boolean);

    const rows = [
      { label: '通信規格', fn: d => d.standard?.contactless || '-' },
      { label: 'ファイルシステム', fn: d => d.standard?.fileSystem || '-' },
      { label: '暗号方式', fn: d => d.security?.encryption || '-' },
      { label: 'アクセス制御', fn: d => d.security?.accessControl?.map(a => a.name).join(', ') || '-' },
      { label: 'Secure Messaging', fn: d => d.security?.secureMessaging || '-' },
      { label: 'AP数', fn: d => (d.applications?.length || 0).toString() },
      { label: '主要AID', fn: d => d.applications?.[0]?.aid || '-' },
      { label: '検証方法', fn: d => d.verification?.method || '-' },
      { label: '検証機関', fn: d => d.verification?.provider || '-' },
      { label: '法的根拠', fn: d => d.amlReference || '-' },
      { label: '仕様版', fn: d => d.metadata?.specVersion || '-' }
    ];

    let tableHtml = '<table class="comparison-table"><thead><tr><th>項目</th>';
    docs.forEach(d => {
      const isPlanned = d.status === 'planned';
      tableHtml += `<th>${d.name} ${isPlanned ? '<span class="info-badge planned-label">予定</span>' : ''}</th>`;
    });
    tableHtml += '</tr></thead><tbody>';

    rows.forEach(row => {
      tableHtml += `<tr><td class="row-label">${row.label}</td>`;
      docs.forEach(d => {
        tableHtml += `<td>${row.fn(d)}</td>`;
      });
      tableHtml += '</tr>';
    });
    tableHtml += '</tbody></table>';

    // Data fields comparison
    let fieldsHtml = '<h3 style="margin:24px 0 12px;font-size:15px;">格納データ項目の比較</h3>';
    const allFieldNames = new Set();
    const fieldMap = {};
    docs.forEach(d => {
      fieldMap[d.id] = new Set();
      (d.applications || []).forEach(app => {
        (app.dfStructure || []).forEach(df => {
          (df.children || []).forEach(ef => {
            (ef.fields || []).forEach(f => {
              allFieldNames.add(f.name);
              fieldMap[d.id].add(f.name);
            });
          });
        });
      });
    });

    fieldsHtml += '<div class="comparison-table-wrapper"><table class="comparison-table"><thead><tr><th>データ項目</th>';
    docs.forEach(d => { fieldsHtml += `<th>${d.name}</th>`; });
    fieldsHtml += '</tr></thead><tbody>';

    [...allFieldNames].forEach(fieldName => {
      fieldsHtml += `<tr><td class="row-label">${fieldName}</td>`;
      docs.forEach(d => {
        const has = fieldMap[d.id].has(fieldName);
        fieldsHtml += `<td style="text-align:center;color:${has ? 'var(--accent-green)' : 'var(--text-muted)'}">${has ? '\u2713' : '-'}</td>`;
      });
      fieldsHtml += '</tr>';
    });
    fieldsHtml += '</tbody></table></div>';

    main.innerHTML = `
      <h2 style="font-size:18px;margin-bottom:16px;">書類間比較</h2>
      <div class="comparison-container">
        <div class="comparison-table-wrapper">${tableHtml}</div>
        ${fieldsHtml}
      </div>`;
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
