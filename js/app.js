/**
 * IC Chip Data Structure Analyzer
 * 犯罪収益移転防止法対応 - 本人確認書類ICチップ データ構造アナライザー
 */

const App = {
  data: {},
  index: null,
  bankingKyc: null,
  refs: null,
  currentDoc: null,
  currentTab: 'structure',
  viewMode: 'detail', // 'detail' or 'compare' or 'banking'

  async init() {
    try {
      const res = await fetch('data/index.json');
      this.index = await res.json();
      await this.loadAllData();
      await this.loadBankingKyc();
      await this.loadRefs();
      this.buildSearchIndex();
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

  async loadBankingKyc() {
    try {
      const res = await fetch('data/banking-kyc-comparison.json');
      this.bankingKyc = await res.json();
    } catch (e) {
      console.warn('Banking KYC data not loaded:', e);
    }
  },

  async loadRefs() {
    try {
      const res = await fetch('data/references.json');
      this.refs = await res.json();
    } catch (e) {
      console.warn('References not loaded:', e);
    }
  },

  buildSearchIndex() {
    this.searchIndex = [];
    for (const [docId, docData] of Object.entries(this.data)) {
      const docName = docData.name;
      (docData.applications || []).forEach(app => {
        (app.dfStructure || []).forEach(df => {
          this._indexNode(df, docId, docName, app.name);
        });
      });
    }
  },

  _indexNode(node, docId, docName, appName) {
    const entry = {
      docId, docName, appName,
      name: node.name,
      type: node.type,
      efid: node.efid,
      tag: '',
      description: node.description || '',
      accessCondition: node.accessCondition || '',
      dataFormat: node.dataFormat || '',
      fieldRef: this._getFieldRef(docId, node.name)
    };
    this.searchIndex.push(entry);
    (node.fields || []).forEach(f => {
      this.searchIndex.push({
        docId, docName, appName,
        name: f.name,
        type: 'field',
        tag: f.tag || '',
        encoding: f.encoding || '',
        description: f.description || '',
        length: f.length || '',
        parentEf: node.name,
        fieldRef: this._getFieldRef(docId, f.name)
      });
    });
    (node.children || []).forEach(c => this._indexNode(c, docId, docName, appName));
  },

  _getFieldRef(docId, fieldName) {
    if (!this.refs?.fieldRefs?.[docId]) return null;
    return this.refs.fieldRefs[docId][fieldName] || null;
  },

  renderRefBadge(fieldRef) {
    if (!fieldRef || !fieldRef.refs?.length) return '';
    const sources = this.refs?.sources;
    if (!sources) return '';
    const links = fieldRef.refs.map(rId => {
      const s = sources[rId];
      if (!s) return '';
      return `<a href="${s.url}" target="_blank" rel="noopener" title="${s.title}" style="font-size:9px;padding:1px 4px;background:rgba(6,182,212,0.12);color:var(--accent-cyan);border-radius:2px;text-decoration:none;white-space:nowrap;">${s.org}</a>`;
    }).filter(Boolean).join(' ');
    const note = fieldRef.note ? `<span style="font-size:10px;color:var(--text-muted);margin-left:4px;" title="${fieldRef.note}">[?]</span>` : '';
    return `<span style="margin-left:6px;display:inline-flex;gap:2px;align-items:center;">${links}${note}</span>`;
  },

  renderRefTooltip(fieldRef) {
    if (!fieldRef) return '';
    const sources = this.refs?.sources;
    if (!sources) return '';
    let html = '<div style="margin-top:4px;">';
    if (fieldRef.note) {
      html += `<div style="font-size:10px;color:var(--text-secondary);margin-bottom:4px;">${fieldRef.note}</div>`;
    }
    fieldRef.refs.forEach(rId => {
      const s = sources[rId];
      if (!s) return;
      html += `<a href="${s.url}" target="_blank" rel="noopener" style="display:inline-block;font-size:10px;padding:1px 5px;margin:1px 2px;background:rgba(6,182,212,0.1);border:1px solid rgba(6,182,212,0.2);color:var(--accent-cyan);border-radius:3px;text-decoration:none;">${s.title} (${s.type})</a> `;
    });
    html += '</div>';
    return html;
  },

  searchItems(query) {
    if (!query || query.length < 1) return [];
    const q = query.toLowerCase();
    return this.searchIndex.filter(item => {
      return (item.name && item.name.toLowerCase().includes(q)) ||
             (item.tag && item.tag.toLowerCase().includes(q)) ||
             (item.description && item.description.toLowerCase().includes(q)) ||
             (item.encoding && item.encoding.toLowerCase().includes(q)) ||
             (item.parentEf && item.parentEf.toLowerCase().includes(q));
    });
  },

  renderSearchResults(query) {
    const results = this.searchItems(query);
    const main = document.getElementById('main-content');
    if (!results.length) {
      main.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-muted);">「${this.escapeHtml(query)}」に一致する項目はありません</div>`;
      return;
    }
    // Group by docId
    const grouped = {};
    results.forEach(r => {
      if (!grouped[r.docId]) grouped[r.docId] = { docName: r.docName, items: [] };
      grouped[r.docId].items.push(r);
    });

    let html = `<h2 style="font-size:16px;margin-bottom:4px;">「${this.escapeHtml(query)}」の検索結果 <span style="font-size:13px;color:var(--text-muted);">${results.length}件</span></h2>
      <p style="font-size:12px;color:var(--text-muted);margin-bottom:16px;">全書類を横断してデータ項目を検索</p>`;

    for (const [docId, group] of Object.entries(grouped)) {
      html += `<div class="tree-container" style="margin-bottom:12px;">
        <div style="margin-bottom:8px;cursor:pointer;" onclick="App.selectDoc('${docId}')">
          <strong style="font-size:14px;color:var(--accent-blue);">${group.docName}</strong>
          <span style="font-size:11px;color:var(--text-muted);margin-left:6px;">${group.items.length}件</span>
        </div>
        <table class="field-table"><thead><tr>
          <th>項目名</th><th>種別</th><th>Tag</th><th>説明</th><th>根拠</th>
        </tr></thead><tbody>`;
      group.items.forEach(item => {
        const typeBadge = item.type === 'field'
          ? '<span style="font-size:9px;padding:1px 4px;background:rgba(168,85,247,0.2);color:var(--accent-purple);border-radius:2px;">Field</span>'
          : `<span class="tree-type-badge ${this.getTypeBadgeClass(item.type)}" style="font-size:9px;">${item.type || 'DF'}</span>`;
        const parentInfo = item.parentEf ? `<span style="font-size:9px;color:var(--text-muted);">${item.parentEf}</span><br>` : '';
        html += `<tr>
          <td><strong>${item.name}</strong></td>
          <td>${typeBadge}</td>
          <td class="tag-cell">${item.tag || item.efid || '-'}</td>
          <td style="font-size:11px;color:var(--text-secondary);">${parentInfo}${item.description}</td>
          <td>${this.renderRefBadge(item.fieldRef)}${this.renderRefTooltip(item.fieldRef)}</td>
        </tr>`;
      });
      html += '</tbody></table></div>';
    }
    main.innerHTML = html;
  },

  bindEvents() {
    const searchInput = document.getElementById('search-input');
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      const q = e.target.value.trim();
      debounceTimer = setTimeout(() => {
        if (q.length >= 1) {
          this.viewMode = 'search';
          document.querySelectorAll('.doc-item').forEach(el => el.classList.remove('active'));
          document.getElementById('btn-compare').classList.remove('btn-active');
          document.getElementById('btn-banking').classList.remove('btn-active');
          this.renderSearchResults(q);
        } else if (this.viewMode === 'search') {
          this.viewMode = 'detail';
          if (this.currentDoc) this.renderDetail();
          else this.renderWelcome();
        }
      }, 200);
    });
    document.getElementById('btn-compare').addEventListener('click', () => {
      this.toggleCompareMode();
    });
    document.getElementById('btn-banking').addEventListener('click', () => {
      this.toggleBankingMode();
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
    document.getElementById('btn-banking').classList.remove('btn-active');
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
        ${this.renderTreeNodes(app.dfStructure || [], 0, this.currentDoc)}
      </div>`;
    });
    return html;
  },

  renderTreeNodes(nodes, depth = 0, docId = null) {
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
      const nodeRef = docId ? this._getFieldRef(docId, node.name) : null;
      const refBadge = this.renderRefBadge(nodeRef);

      return `
        <div class="tree-node">
          <div class="tree-node-header" onclick="App.toggleNode('${nodeId}')">
            <span class="tree-toggle ${expandable ? '' : 'empty'}" id="toggle-${nodeId}">\u25B6</span>
            <span class="tree-type-badge ${typeBadgeClass}">${node.type || 'DF'}</span>
            <span class="tree-node-name">${node.name}</span>
            ${accessBadge}
            ${refBadge}
            <span class="tree-node-id">${idText}</span>
          </div>
          <div class="tree-node-children" id="children-${nodeId}" style="display:none;">
            ${node.description ? `<div class="field-detail-desc" style="margin-left:24px;padding:4px 0;font-size:12px;color:var(--text-secondary);">${node.description}</div>` : ''}
            ${node.dataFormat ? `<div style="margin-left:24px;padding:2px 0;font-size:11px;color:var(--accent-purple);">Format: ${node.dataFormat}</div>` : ''}
            ${hasFields ? this.renderFieldTable(node.fields, docId) : ''}
            ${hasChildren ? this.renderTreeNodes(node.children, depth + 1, docId) : ''}
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

  renderFieldTable(fields, docId = null) {
    if (!fields || !fields.length) return '';
    let html = `<div class="field-detail"><table class="field-table">
      <thead><tr>
        <th>Name</th><th>Tag</th><th>Length</th><th>Encoding</th><th>Description</th><th>根拠</th>
      </tr></thead><tbody>`;
    fields.forEach(f => {
      const subFields = f.subFields
        ? `<br><span style="font-size:10px;color:var(--text-muted);">[${f.subFields.join(', ')}]</span>` : '';
      const fieldRef = docId ? this._getFieldRef(docId, f.name) : null;
      html += `<tr>
        <td>${f.name}</td>
        <td class="tag-cell">${f.tag || '-'}</td>
        <td>${f.length || '-'}</td>
        <td class="encoding-cell">${f.encoding || '-'}</td>
        <td>${f.description || ''}${subFields}</td>
        <td>${this.renderRefBadge(fieldRef)}${fieldRef ? this.renderRefTooltip(fieldRef) : ''}</td>
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
      document.getElementById('btn-banking').classList.remove('btn-active');
      document.querySelectorAll('.doc-item').forEach(el => el.classList.remove('active'));
      this.renderComparison();
    }
  },

  toggleBankingMode() {
    if (this.viewMode === 'banking') {
      this.viewMode = 'detail';
      document.getElementById('btn-banking').classList.remove('btn-active');
      if (this.currentDoc) {
        this.renderDetail();
      } else {
        this.renderWelcome();
      }
    } else {
      this.viewMode = 'banking';
      this.bankingTab = 'cif-mapping';
      document.getElementById('btn-banking').classList.add('btn-active');
      document.getElementById('btn-compare').classList.remove('btn-active');
      document.querySelectorAll('.doc-item').forEach(el => el.classList.remove('active'));
      this.renderBankingKyc();
    }
  },

  switchBankingTab(tab) {
    this.bankingTab = tab;
    this.renderBankingKyc();
  },

  renderBankingKyc() {
    const main = document.getElementById('main-content');
    const kyc = this.bankingKyc;
    if (!kyc) { main.innerHTML = '<p>勘定系KYCデータが読み込めませんでした</p>'; return; }

    const tab = this.bankingTab || 'cif-mapping';
    const tabs = [
      { id: 'cif-mapping', label: 'CIFマッピング' },
      { id: 'name-analysis', label: '氏名フィールド分析' },
      { id: 'cross-issues', label: '書類間の課題' },
      { id: 'legal-requirements', label: '法定確認項目' }
    ];

    let html = `
      <h2 style="font-size:18px;margin-bottom:4px;">勘定系取引 本人確認データ構造比較</h2>
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;">${kyc.description}</p>
      <div class="tabs">
        ${tabs.map(t => `<div class="tab ${tab === t.id ? 'active' : ''}" onclick="App.switchBankingTab('${t.id}')">${t.label}</div>`).join('')}
      </div>
      <div id="banking-tab-content">`;

    switch (tab) {
      case 'cif-mapping': html += this.renderCifMapping(kyc); break;
      case 'name-analysis': html += this.renderNameAnalysis(kyc); break;
      case 'cross-issues': html += this.renderCrossIssues(kyc); break;
      case 'legal-requirements': html += this.renderLegalRequirements(kyc); break;
    }

    html += '</div>';
    main.innerHTML = html;
  },

  getReliabilityBadge(r) {
    const map = {
      high: { label: '取得可', cls: 'free' },
      medium: { label: '条件付', cls: 'pin' },
      foreignerOnly: { label: '外国人のみ', cls: 'bac' },
      low: { label: '困難', cls: 'bac' },
      none: { label: '取得不可', cls: 'planned-label' }
    };
    const m = map[r] || map.none;
    return `<span class="info-badge ${m.cls}">${m.label}</span>`;
  },

  renderCifMapping(kyc) {
    const mapping = kyc.bankingDataMapping;
    const docNames = {
      'my-number-card': 'マイナンバー',
      'drivers-license': '運転免許証',
      'residence-card': '在留カード',
      'passport': 'パスポート',
      'special-permanent-resident': '特別永住者'
    };
    const docKeys = Object.keys(docNames);

    let html = `<h3 style="font-size:15px;margin-bottom:12px;">${mapping.title}</h3>
      <p style="font-size:12px;color:var(--text-secondary);margin-bottom:16px;">${mapping.description}</p>`;

    mapping.cifFields.forEach(cif => {
      html += `<div class="tree-container" style="margin-bottom:12px;">
        <div style="margin-bottom:8px;display:flex;align-items:center;gap:8px;">
          <strong style="font-size:14px;">${cif.cifField}</strong>
          <span style="font-size:11px;color:var(--text-muted);">CIF形式: ${cif.cifFormat}</span>
        </div>
        <table class="field-table">
          <thead><tr><th>書類</th><th>取得元</th><th>パース方法</th><th>信頼度</th></tr></thead>
          <tbody>`;
      docKeys.forEach(dk => {
        const src = cif.sources[dk];
        if (!src) return;
        html += `<tr>
          <td><strong>${docNames[dk]}</strong></td>
          <td style="font-size:11px;font-family:monospace;color:var(--accent-cyan);">${src.field}</td>
          <td style="font-size:11px;color:var(--text-secondary);">${src.parsing}</td>
          <td>${this.getReliabilityBadge(src.reliability)}</td>
        </tr>`;
      });
      html += '</tbody></table></div>';
    });

    return html;
  },

  renderNameAnalysis(kyc) {
    const nameData = kyc.nameFieldAnalysis;
    const docs = nameData.documents;
    let html = `<h3 style="font-size:15px;margin-bottom:4px;">${nameData.title}</h3>
      <p style="font-size:12px;color:var(--text-secondary);margin-bottom:16px;">${nameData.description}</p>`;

    for (const [docId, doc] of Object.entries(docs)) {
      html += `<div class="tree-container" style="margin-bottom:16px;">
        <h4 style="font-size:14px;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid var(--border-color);">${doc.documentName}</h4>`;

      // Spec note
      if (doc.specNote) {
        html += `<div class="disclaimer" style="margin-bottom:12px;">${doc.specNote}</div>`;
      }

      // References
      if (doc.references?.length) {
        html += this.renderReferences(doc.references);
      }

      (doc.nameFields || []).forEach(nf => {
        const fields = nf.fields || [nf];
        fields.forEach(field => {
          html += `<div style="margin-bottom:12px;padding:12px;background:var(--bg-highlight);border-radius:var(--radius);border:1px solid var(--border-color);">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
              <strong style="font-size:13px;">${field.name || nf.source}</strong>
              ${field.tag ? `<span style="font-family:monospace;font-size:11px;color:var(--accent-cyan);">Tag: ${field.tag}</span>` : ''}
              ${field.encoding ? `<span style="font-size:11px;color:var(--accent-purple);">${field.encoding}</span>` : ''}
              ${field.maxLength ? `<span style="font-size:11px;color:var(--text-muted);">Max: ${field.maxLength}</span>` : ''}
            </div>`;

          const structure = field.structure || nf.structure;
          if (structure) {
            // Japanese
            if (structure.japanese) {
              html += this.renderNameExample('日本人', structure.japanese);
            }
            // Foreigner
            if (structure.foreigner) {
              html += this.renderNameExample('外国人', structure.foreigner);
            }
            // General example
            if (structure.example && !structure.japanese) {
              html += `<div style="margin-top:6px;padding:6px 10px;background:var(--bg-secondary);border-radius:4px;font-family:monospace;font-size:12px;color:var(--accent-green);">${this.escapeHtml(structure.example)}</div>`;
              if (structure.format) {
                html += `<div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Format: ${structure.format}</div>`;
              }
              if (structure.notes) {
                html += `<div style="font-size:11px;color:var(--text-secondary);margin-top:4px;">${structure.notes}</div>`;
              }
            }
            // Delimiter detail
            if (structure.delimiter_detail) {
              html += this.renderDelimiterDetail(structure.delimiter_detail);
            }
            // Parsing steps
            if (structure.parsing) {
              html += this.renderParsingSteps(structure.parsing);
            }
          }
          html += '</div>';
        });
      });

      // Banking mapping
      const mappingSource = doc.nameFields?.[0];
      const bm = mappingSource?.bankingMapping;
      if (bm) {
        html += `<div style="margin-top:8px;padding:12px;border:1px solid rgba(59,130,246,0.3);border-radius:var(--radius);background:rgba(59,130,246,0.05);">
          <strong style="font-size:12px;color:var(--accent-blue);">CIFマッピング</strong>
          <table class="field-table" style="margin-top:8px;">
            <tbody>
              <tr><td style="white-space:nowrap"><strong>漢字氏名</strong></td><td style="font-size:11px;">${bm.kanji_name}</td></tr>
              <tr><td style="white-space:nowrap"><strong>カナ氏名</strong></td><td style="font-size:11px;">${bm.kana_name}</td></tr>
              <tr><td style="white-space:nowrap"><strong>ローマ字</strong></td><td style="font-size:11px;">${bm.roman_name}</td></tr>
            </tbody>
          </table>
          ${bm.notes ? `<div class="notes-box" style="margin-top:8px;"><strong>Note:</strong> ${bm.notes}</div>` : ''}
        </div>`;
      }

      // Limitations
      if (doc.limitations?.length) {
        html += `<div style="margin-top:12px;">
          <strong style="font-size:12px;color:var(--accent-yellow);">制約・注意事項</strong>
          <ul style="margin-top:6px;padding-left:16px;">
            ${doc.limitations.map(l => `<li style="font-size:12px;color:var(--text-secondary);padding:2px 0;">${l}</li>`).join('')}
          </ul>
        </div>`;
      }

      html += '</div>';
    }
    return html;
  },

  renderNameExample(label, data) {
    let html = `<div style="margin-top:8px;padding:8px 10px;background:var(--bg-secondary);border-radius:4px;border-left:3px solid var(--accent-blue);">
      <div style="font-size:11px;font-weight:600;color:var(--accent-blue);margin-bottom:4px;">${label}</div>`;
    if (data.example) {
      html += `<div style="font-family:monospace;font-size:12px;color:var(--accent-green);padding:4px 0;">${this.escapeHtml(data.example)}</div>`;
    }
    if (data.format) {
      html += `<div style="font-size:11px;color:var(--text-muted);">Format: <code>${data.format}</code></div>`;
    }
    if (data.notes) {
      html += `<div style="font-size:11px;color:var(--text-secondary);margin-top:4px;">${data.notes}</div>`;
    }
    if (data.delimiter_detail) {
      html += this.renderDelimiterDetail(data.delimiter_detail);
    }
    if (data.parsing) {
      html += this.renderParsingSteps(data.parsing);
    }
    html += '</div>';
    return html;
  },

  renderDelimiterDetail(dd) {
    return `<div style="margin-top:8px;padding:8px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:4px;">
      <div style="font-size:11px;font-weight:600;color:var(--accent-red);margin-bottom:4px;">区切り文字</div>
      <div style="font-family:monospace;font-size:13px;color:var(--accent-red);font-weight:600;">${this.escapeHtml(dd.char)}</div>
      <div style="font-size:11px;color:var(--text-secondary);margin-top:4px;">${dd.description}</div>
      ${dd.usage ? `<div style="font-size:11px;color:var(--text-secondary);margin-top:2px;">${dd.usage}</div>` : ''}
      ${dd.important ? `<div style="font-size:11px;color:var(--accent-yellow);margin-top:4px;font-weight:500;">${dd.important}</div>` : ''}
    </div>`;
  },

  renderParsingSteps(steps) {
    let html = '<div style="margin-top:8px;"><div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">パース手順</div>';
    steps.forEach(s => {
      const resultStr = Array.isArray(s.result) ? `[${s.result.map(r => `"${r}"`).join(', ')}]` : s.result;
      html += `<div style="display:flex;gap:8px;align-items:flex-start;padding:3px 0;">
        <span style="font-size:10px;background:var(--accent-blue);color:white;border-radius:50%;width:16px;height:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;">${s.step}</span>
        <div style="font-size:11px;">
          <span style="color:var(--text-secondary);">${s.action}</span>
          <span style="color:var(--accent-green);font-family:monospace;margin-left:4px;">${this.escapeHtml(resultStr)}</span>
        </div>
      </div>`;
    });
    html += '</div>';
    return html;
  },

  renderCrossIssues(kyc) {
    const issues = kyc.nameFieldAnalysis.crossDocumentIssues;
    let html = '<h3 style="font-size:15px;margin-bottom:12px;">書類間のデータ構造 共通課題</h3>';
    issues.forEach(issue => {
      html += `<div class="tree-container" style="margin-bottom:12px;">
        <h4 style="font-size:14px;color:var(--accent-yellow);margin-bottom:8px;">${issue.issue}</h4>
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:8px;">${issue.description}</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div style="padding:10px;background:rgba(239,68,68,0.08);border-radius:var(--radius);border:1px solid rgba(239,68,68,0.2);">
            <strong style="font-size:11px;color:var(--accent-red);">影響</strong>
            <p style="font-size:12px;color:var(--text-secondary);margin-top:4px;">${issue.impact}</p>
          </div>
          <div style="padding:10px;background:rgba(34,197,94,0.08);border-radius:var(--radius);border:1px solid rgba(34,197,94,0.2);">
            <strong style="font-size:11px;color:var(--accent-green);">対処法</strong>
            <p style="font-size:12px;color:var(--text-secondary);margin-top:4px;">${issue.workaround}</p>
          </div>
        </div>
      </div>`;
    });
    return html;
  },

  renderLegalRequirements(kyc) {
    const legal = kyc.legalRequirements;
    let html = `<h3 style="font-size:15px;margin-bottom:4px;">法定確認項目</h3>
      <p style="font-size:12px;color:var(--text-secondary);margin-bottom:16px;">${legal.law} ${legal.article}（${legal.regulation}）</p>`;

    // References
    if (legal.references?.length) {
      html += this.renderReferences(legal.references);
    }

    html += `<div class="apdu-table-container"><table class="apdu-table">
        <thead><tr><th>項目</th><th>必須</th><th>説明</th><th>ICチップ</th><th>備考</th></tr></thead><tbody>`;

    legal.requiredItems.forEach(item => {
      const reqBadge = item.required === true
        ? '<span class="info-badge bac">必須</span>'
        : '<span class="info-badge pin">条件付</span>';
      const inChip = item.inChip === false
        ? '<span class="info-badge planned-label">非格納</span>'
        : '<span class="info-badge free">格納</span>';
      html += `<tr>
        <td><strong>${item.name}</strong></td>
        <td>${reqBadge}</td>
        <td style="font-size:12px;color:var(--text-secondary);">${item.description}</td>
        <td>${inChip}</td>
        <td style="font-size:11px;color:var(--text-muted);">${item.condition || item.bankingNotes || ''}</td>
      </tr>`;
    });
    html += '</tbody></table></div>';

    // Amendment notes
    if (legal.amendmentNotes) {
      html += `<div style="margin-top:16px;padding:16px;background:rgba(249,115,22,0.08);border:1px solid rgba(249,115,22,0.2);border-radius:var(--radius-lg);">
        <h4 style="font-size:13px;color:var(--accent-orange);margin-bottom:8px;">${legal.amendmentNotes.title}</h4>
        <ul style="padding-left:16px;">
          ${legal.amendmentNotes.items.map(i => `<li style="font-size:12px;color:var(--text-secondary);padding:3px 0;">${i}</li>`).join('')}
        </ul>
      </div>`;
    }

    return html;
  },

  renderReferences(refs) {
    if (!refs || !refs.length) return '';
    let html = `<div style="margin-bottom:12px;padding:10px 12px;background:rgba(6,182,212,0.06);border:1px solid rgba(6,182,212,0.15);border-radius:var(--radius);">
      <div style="font-size:11px;font-weight:600;color:var(--accent-cyan);margin-bottom:6px;">根拠資料</div>`;
    refs.forEach(ref => {
      html += `<div style="margin-bottom:4px;">
        <a href="${ref.url}" target="_blank" rel="noopener" style="font-size:12px;color:var(--accent-blue);text-decoration:none;">${ref.title}</a>
        ${ref.description ? `<span style="font-size:10px;color:var(--text-muted);margin-left:4px;">- ${ref.description}</span>` : ''}
      </div>`;
    });
    html += '</div>';
    return html;
  },

  escapeHtml(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
