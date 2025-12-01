import { useState, useEffect, useCallback } from "react";
import "./App.css";

let idCounter = 0;
const createId = () => {
  idCounter += 1;
  return `id-${idCounter}`;
};

export default function App() {
  // State
  const [exchangeRate, setExchangeRate] = useState(205);
  const [markupPercent, setMarkupPercent] = useState(10);
  const [profitMarginPercent, setProfitMarginPercent] = useState(30);
  const [itemName, setItemName] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [cnyPrice, setCnyPrice] = useState("");
  const [qty, setQty] = useState(1);
  const [batchName, setBatchName] = useState("");
  const [items, setItems] = useState([]);
  const [editingItemId, setEditingItemId] = useState(null);
  const [editingFields, setEditingFields] = useState({
    name: "",
    url: "",
    cnyPrice: "",
    quantity: "1",
  });
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState("pricing");
  const [expandedBatch, setExpandedBatch] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  
  // Hardcoded company logo
  const logoUrl = "https://res.cloudinary.com/dupgdbwrt/image/upload/v1759971092/icon-512x512.png_ygtda9.png";

  // Load from localStorage
  useEffect(() => {
    try {
      const savedItems = localStorage.getItem("jm_items");
      if (savedItems) {
        const parsed = JSON.parse(savedItems);
        setItems(parsed);
        const maxId = parsed.reduce((max, item) => {
          const match = String(item.id || "").match(/id-(\d+)/);
          return match ? Math.max(max, parseInt(match[1], 10)) : max;
        }, 0);
        if (maxId > idCounter) idCounter = maxId;
      }
      
      const savedSettings = localStorage.getItem("jm_settings");
      if (savedSettings) {
        const s = JSON.parse(savedSettings);
        setExchangeRate(s.exchangeRate || 205);
        setMarkupPercent(s.markupPercent || 10);
        setProfitMarginPercent(s.profitMarginPercent || 30);
      }
      
      const savedHistory = localStorage.getItem("jm_history");
      if (savedHistory) setHistory(JSON.parse(savedHistory));
    } catch (e) {
      console.error("Load error:", e);
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem("jm_items", JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem("jm_settings", JSON.stringify({ exchangeRate, markupPercent, profitMarginPercent }));
  }, [exchangeRate, markupPercent, profitMarginPercent]);

  useEffect(() => {
    localStorage.setItem("jm_history", JSON.stringify(history));
  }, [history]);

  // Calculate pricing
  const calculateItem = useCallback((price) => {
    const baseCost = price * exchangeRate;
    const markedUp = baseCost * (1 + markupPercent / 100);
    const selling = markedUp / (1 - profitMarginPercent / 100);
    const profit = selling - markedUp;
    return { baseCost, markedUp, selling, profit };
  }, [exchangeRate, markupPercent, profitMarginPercent]);

  // Add item
  const handleAddItem = (e) => {
    e.preventDefault();
    if (!itemName.trim() || !cnyPrice || qty < 1) return;

    const price = parseFloat(cnyPrice);
    const quantity = parseInt(qty);
    const calc = calculateItem(price);
    const normalizedUrl = normalizeProductUrl(productUrl);

    const newItem = {
      id: createId(),
      name: itemName.trim(),
      url: normalizedUrl,
      cnyPrice: price,
      quantity,
      ...calc,
    };

    setItems([...items, newItem]);
    setItemName("");
    setProductUrl("");
    setCnyPrice("");
    setQty(1);
  };

  // Begin editing an item
  const handleStartEdit = (item) => {
    setEditingItemId(item.id);
    setEditingFields({
      name: item.name,
      url: item.url || "",
      cnyPrice: item.cnyPrice.toString(),
      quantity: item.quantity.toString(),
    });
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditingFields({ name: "", url: "", cnyPrice: "", quantity: "1" });
  };

  const handleEditFieldChange = (field, value) => {
    setEditingFields((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveEdit = (id) => {
    const parsedPrice = parseFloat(editingFields.cnyPrice);
    const parsedQty = parseInt(editingFields.quantity);
    const price = Number.isFinite(parsedPrice) && parsedPrice >= 0 ? parsedPrice : 0;
    const quantity = Number.isFinite(parsedQty) && parsedQty > 0 ? parsedQty : 1;
    const normalizedUrl = normalizeProductUrl(editingFields.url || "");
    const name = editingFields.name.trim() || "Untitled Item";
    const calc = calculateItem(price);

    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              name,
              url: normalizedUrl,
              cnyPrice: price,
              quantity,
              ...calc,
            }
          : item
      )
    );
    handleCancelEdit();
  };

  // Delete item
  const handleDeleteItem = (id) => {
    setItems(items.filter((item) => item.id !== id));
  };

  // Recalculate all items when settings change
  useEffect(() => {
    if (items.length > 0) {
      setItems((prev) =>
        prev.map((item) => ({
          ...item,
          ...calculateItem(item.cnyPrice),
        }))
      );
    }
  }, [calculateItem, items.length]);

  // Totals
  const totals = items.reduce(
    (acc, item) => ({
      units: acc.units + item.quantity,
      cost: acc.cost + item.markedUp * item.quantity,
      revenue: acc.revenue + item.selling * item.quantity,
      profit: acc.profit + item.profit * item.quantity,
    }),
    { units: 0, cost: 0, revenue: 0, profit: 0 }
  );

  const margin = totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0;

  // Save batch
  const handleSaveBatch = () => {
    if (items.length === 0) return;
    const batch = {
      id: createId(),
      name: batchName.trim() || `Batch ${new Date().toLocaleDateString()}`,
      date: new Date().toISOString(),
      items: [...items],
      totals: { ...totals },
      settings: { exchangeRate, markupPercent, profitMarginPercent },
    };
    setHistory([batch, ...history]);
    setBatchName("");
  };

  // Clear items
  const handleClearItems = () => {
    if (window.confirm("Clear all items?")) {
      setItems([]);
    }
  };

  // Delete batch
  const handleDeleteBatch = (id) => {
    if (window.confirm("Delete this batch?")) {
      setHistory(history.filter((b) => b.id !== id));
    }
  };

  // Load batch
  const handleLoadBatch = (batch) => {
    if (window.confirm("Load this batch? Current items will be replaced.")) {
      setItems(batch.items);
      if (batch.settings) {
        setExchangeRate(batch.settings.exchangeRate);
        setMarkupPercent(batch.settings.markupPercent);
        setProfitMarginPercent(batch.settings.profitMarginPercent);
      }
      setActiveTab("pricing");
    }
  };

  // Format number
  const fmt = (n) => Math.round(n).toLocaleString();

  // Normalize product links to accept non-ASCII domains and missing protocols
  const normalizeProductUrl = (rawUrl) => {
    const trimmed = rawUrl.trim();
    if (!trimmed) return "";
    const hasProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed);
    const urlWithProtocol = hasProtocol ? trimmed : `https://${trimmed}`;
    try {
      return encodeURI(urlWithProtocol);
    } catch (err) {
      console.warn("Could not encode product URL, using raw value", err);
      return urlWithProtocol;
    }
  };

  // Export batch to JSON file
  const handleExportBatch = (batch) => {
    const exportData = {
      ...batch,
      exportedAt: new Date().toISOString(),
      appVersion: "JulineMart v2",
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${batch.name.replace(/[^a-z0-9]/gi, "_")}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export all batches
  const handleExportAllBatches = () => {
    if (history.length === 0) return;
    const exportData = {
      batches: history,
      exportedAt: new Date().toISOString(),
      appVersion: "JulineMart v2",
      totalBatches: history.length,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `JulineMart_AllBatches_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import batches from JSON file
  const handleImportBatches = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        
        // Check if it's a single batch or multiple batches
        if (data.batches && Array.isArray(data.batches)) {
          // Multiple batches
          const newBatches = data.batches.map((batch) => ({
            ...batch,
            id: createId(),
            importedAt: new Date().toISOString(),
          }));
          setHistory([...newBatches, ...history]);
          alert(`Successfully imported ${newBatches.length} batches!`);
        } else if (data.items && Array.isArray(data.items)) {
          // Single batch
          const newBatch = {
            ...data,
            id: createId(),
            importedAt: new Date().toISOString(),
          };
          setHistory([newBatch, ...history]);
          alert(`Successfully imported batch: ${data.name}`);
        } else {
          alert("Invalid file format. Please select a valid JulineMart export file.");
        }
      } catch (err) {
        alert("Error reading file. Please make sure it's a valid JSON file.");
        console.error("Import error:", err);
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  // Export current workspace to CSV
  const handleExportCSV = () => {
    if (items.length === 0) return;
    
    const headers = ["Item Name", "CNY Price", "Quantity", "Cost (NGN)", "Selling (NGN)", "Profit (NGN)", "Total Profit (NGN)"];
    const rows = items.map((item) => [
      item.name,
      item.cnyPrice.toFixed(2),
      item.quantity,
      Math.round(item.markedUp),
      Math.round(item.selling),
      Math.round(item.profit),
      Math.round(item.profit * item.quantity),
    ]);
    
    // Add totals row
    rows.push([]);
    rows.push(["TOTALS", "", totals.units, fmt(totals.cost), fmt(totals.revenue), fmt(totals.profit), fmt(totals.profit)]);
    rows.push([]);
    rows.push([`Settings: Exchange Rate: ${exchangeRate}, Markup: ${markupPercent}%, Margin: ${profitMarginPercent}%`]);
    
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `JulineMart_Workspace_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-brand">
          <img src={logoUrl} alt="JulineMart Logo" className="custom-logo" />
          <div>
            <h1>JulineMart</h1>
            <span>Import Pricing Calculator</span>
          </div>
        </div>
        <div className="header-info">
          <span className="rate-badge">1 CNY = ₦{exchangeRate}</span>
          <button
            type="button"
            className="btn-settings"
            onClick={() => setShowSettings(!showSettings)}
          >
            ⚙️ Settings
          </button>
        </div>
      </header>

      {/* Settings Panel */}
      {showSettings && (
        <div className="settings-panel">
          <div className="settings-grid">
            <div className="setting-item">
              <label>Exchange Rate (CNY → NGN)</label>
              <input
                type="number"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="setting-item">
              <label>Markup % (shipping/cargo)</label>
              <input
                type="number"
                value={markupPercent}
                onChange={(e) => setMarkupPercent(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="setting-item">
              <label>Target Profit Margin %</label>
              <input
                type="number"
                value={profitMarginPercent}
                onChange={(e) => setProfitMarginPercent(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
          <div className="settings-preview">
            Example: ¥100 → ₦{fmt(calculateItem(100).selling)} selling price
          </div>
        </div>
      )}

      {/* Tabs */}
      <nav className="tabs">
        <button
          type="button"
          className={`tab ${activeTab === "pricing" ? "active" : ""}`}
          onClick={() => setActiveTab("pricing")}
        >
          📦 Pricing
        </button>
        <button
          type="button"
          className={`tab ${activeTab === "history" ? "active" : ""}`}
          onClick={() => setActiveTab("history")}
        >
          📋 History ({history.length})
        </button>
      </nav>

      {/* Main Content */}
      <main className="main">
        {activeTab === "pricing" && (
          <>
            {/* Stats Cards */}
            <div className="stats-row">
              <div className="stat-card">
                <span className="stat-label">Units</span>
                <span className="stat-value">{totals.units}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Revenue</span>
                <span className="stat-value">₦{fmt(totals.revenue)}</span>
              </div>
              <div className="stat-card highlight">
                <span className="stat-label">Profit</span>
                <span className="stat-value">₦{fmt(totals.profit)}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Margin</span>
                <span className="stat-value">{margin.toFixed(1)}%</span>
              </div>
            </div>

            {/* Add Item Form */}
            <div className="card">
              <div className="card-header">
                <h2>➕ Add New Item</h2>
              </div>
              <form onSubmit={handleAddItem} className="add-form">
                <div className="form-group">
                  <label>Item Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Wireless Earbuds"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Product URL</label>
                  <input
                    type="text"
                    inputMode="url"
                    placeholder="https://example.com/item or 1688/Pinduoduo link"
                    value={productUrl}
                    onChange={(e) => setProductUrl(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Price (CNY)</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    step="0.01"
                    value={cnyPrice}
                    onChange={(e) => setCnyPrice(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn-primary">
                  Add Item
                </button>
              </form>
              {cnyPrice > 0 && (
                <div className="preview-box">
                  <strong>Preview:</strong> Sell at ₦{fmt(calculateItem(parseFloat(cnyPrice)).selling)} 
                  {" "}(₦{fmt(calculateItem(parseFloat(cnyPrice)).profit)} profit per item)
                </div>
              )}
            </div>

            {/* Items List */}
            <div className="card">
              <div className="card-header">
                <h2>📋 Items ({items.length})</h2>
                <div className="card-actions">
                  <input
                    type="text"
                    placeholder="Batch name..."
                    value={batchName}
                    onChange={(e) => setBatchName(e.target.value)}
                    className="batch-input"
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleSaveBatch}
                    disabled={items.length === 0}
                  >
                    💾 Save
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleExportCSV}
                    disabled={items.length === 0}
                    title="Export to CSV"
                  >
                    📊 CSV
                  </button>
                  <button
                    type="button"
                    className="btn-danger"
                    onClick={handleClearItems}
                    disabled={items.length === 0}
                  >
                    🗑️ Clear
                  </button>
                </div>
              </div>

              {items.length === 0 ? (
                <div className="empty-state">
                  <p>No items yet. Add your first item above!</p>
                </div>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>CNY</th>
                        <th>Qty</th>
                        <th>Cost (₦)</th>
                        <th>Sell (₦)</th>
                        <th>Profit (₦)</th>
                        <th>Total (₦)</th>
                        <th>Link</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => {
                        const isEditing = editingItemId === item.id;
                        return (
                          <tr key={item.id} className={isEditing ? "editing-row" : ""}>
                            <td className="item-name" data-label="Item">
                              {isEditing ? (
                                <input
                                  className="table-input"
                                  value={editingFields.name}
                                  onChange={(e) => handleEditFieldChange("name", e.target.value)}
                                />
                              ) : (
                                <span>{item.name}</span>
                              )}
                            </td>
                            <td data-label="CNY">
                              {isEditing ? (
                                <input
                                  type="number"
                                  className="table-input number"
                                  step="0.01"
                                  min="0"
                                  value={editingFields.cnyPrice}
                                  onChange={(e) => handleEditFieldChange("cnyPrice", e.target.value)}
                                />
                              ) : (
                                <>¥{item.cnyPrice.toFixed(2)}</>
                              )}
                            </td>
                            <td data-label="Qty">
                              {isEditing ? (
                                <input
                                  type="number"
                                  className="table-input number"
                                  min="1"
                                  value={editingFields.quantity}
                                  onChange={(e) => handleEditFieldChange("quantity", e.target.value)}
                                />
                              ) : (
                                item.quantity
                              )}
                            </td>
                            <td data-label="Cost">₦{fmt(item.markedUp)}</td>
                            <td data-label="Sell">₦{fmt(item.selling)}</td>
                            <td data-label="Profit" className="profit-cell">₦{fmt(item.profit)}</td>
                            <td data-label="Total" className="total-cell">₦{fmt(item.profit * item.quantity)}</td>
                            <td data-label="Link">
                              {isEditing ? (
                                <input
                                  className="table-input"
                                  placeholder="https://your-link"
                                  value={editingFields.url}
                                  onChange={(e) => handleEditFieldChange("url", e.target.value)}
                                />
                              ) : item.url ? (
                                <a href={item.url} target="_blank" rel="noreferrer" className="btn-secondary">
                                  View
                                </a>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td data-label="Actions">
                              {isEditing ? (
                                <div className="row-actions">
                                  <button
                                    type="button"
                                    className="btn-primary btn-small"
                                    onClick={() => handleSaveEdit(item.id)}
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-secondary btn-small"
                                    onClick={handleCancelEdit}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div className="row-actions">
                                  <button
                                    type="button"
                                    className="btn-secondary btn-small"
                                    onClick={() => handleStartEdit(item)}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-delete"
                                    onClick={() => handleDeleteItem(item.id)}
                                  >
                                    ✕
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan="3"><strong>TOTALS</strong></td>
                        <td>₦{fmt(totals.cost)}</td>
                        <td>₦{fmt(totals.revenue)}</td>
                        <td className="profit-cell">₦{fmt(totals.profit)}</td>
                        <td className="total-cell">₦{fmt(totals.profit)}</td>
                        <td></td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === "history" && (
          <div className="card">
            <div className="card-header">
              <h2>📋 Saved Batches ({history.length})</h2>
              <div className="card-actions">
                <label className="btn-secondary import-btn">
                  📥 Import
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportBatches}
                    style={{ display: "none" }}
                  />
                </label>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleExportAllBatches}
                  disabled={history.length === 0}
                >
                  📤 Export All
                </button>
              </div>
            </div>

            {history.length === 0 ? (
              <div className="empty-state">
                <p>No saved batches yet.</p>
                <p style={{ fontSize: "13px", marginTop: "8px", color: "#94a3b8" }}>
                  Save a batch from the Pricing tab or import from a file.
                </p>
              </div>
            ) : (
              <div className="batch-list">
                {history.map((batch) => (
                  <div key={batch.id} className="batch-item">
                    <div
                      className="batch-header"
                      onClick={() => setExpandedBatch(expandedBatch === batch.id ? null : batch.id)}
                    >
                      <div className="batch-info">
                        <strong>{batch.name}</strong>
                        <span className="batch-meta">
                          {batch.items.length} items · ₦{fmt(batch.totals.revenue)} revenue · ₦{fmt(batch.totals.profit)} profit
                        </span>
                        <span className="batch-date">
                          {new Date(batch.date).toLocaleDateString()}
                          {batch.importedAt && " · Imported"}
                        </span>
                      </div>
                      <span className="batch-toggle">
                        {expandedBatch === batch.id ? "▼" : "▶"}
                      </span>
                    </div>

                    {expandedBatch === batch.id && (
                      <div className="batch-details">
                        <div className="batch-actions">
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => handleLoadBatch(batch)}
                          >
                            📥 Load
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => handleExportBatch(batch)}
                          >
                            📤 Export
                          </button>
                          <button
                            type="button"
                            className="btn-danger"
                            onClick={() => handleDeleteBatch(batch.id)}
                          >
                            🗑️ Delete
                          </button>
                        </div>
                        {batch.settings && (
                          <div className="batch-settings-info">
                            FX: {batch.settings.exchangeRate} · Markup: {batch.settings.markupPercent}% · Margin: {batch.settings.profitMarginPercent}%
                          </div>
                        )}
                        <div className="batch-items">
                          {batch.items.map((item, idx) => (
                            <div key={idx} className="batch-item-row">
                              <span>{item.name}</span>
                              <span>{item.quantity}x · ¥{item.cnyPrice} · Sell: ₦{fmt(item.selling)}</span>
                              {item.url && (
                                <a
                                  href={item.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn-secondary"
                                  style={{ marginLeft: "auto" }}
                                >
                                  View Link
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}








