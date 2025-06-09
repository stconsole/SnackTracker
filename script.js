// Constants
const CATEGORIES = {
    CHIPS: 'chips',
    CANDY: 'candy',
    DRINKS: 'drinks'
};

// Global variables
let inventory = JSON.parse(localStorage.getItem('snackInventory')) || [];
let currentTheme = localStorage.getItem('theme') || 'light';
let profitChart = null; // Chart instance variable

// Initialize the app
function init() {
    initTheme();
    document.getElementById('datePurchased').valueAsDate = new Date();
    document.getElementById('dateSold').valueAsDate = new Date();

    // Migration: Mark existing items as purchases
    let needsMigration = false;
    inventory.forEach(item => {
        if (item.isPurchase === undefined) {
            item.isPurchase = true;
            needsMigration = true;
        }
    });

    if (needsMigration) {
        saveData();
    }

    updateDropdown();
    renderTable();
    updateInventoryHealth();
    updateProfitChart();
}

// Theme functions
function initTheme() {
    document.documentElement.setAttribute('data-theme', currentTheme);
    document.getElementById('theme-icon').textContent = currentTheme === 'dark' ? '☀️' : '🌙';
}

function toggleTheme() {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', currentTheme);
    document.getElementById('theme-icon').textContent = currentTheme === 'dark' ? '☀️' : '🌙';
    localStorage.setItem('theme', currentTheme);
}

// Profit Chart Implementation
function updateProfitChart() {
    const ctx = document.getElementById('profitChart').getContext('2d');

    // Destroy previous chart if it exists
    if (profitChart) {
        profitChart.destroy();
    }

    // Filter sales data and calculate daily profits
    const sales = inventory.filter(item => !item.isPurchase);
    const dailyProfits = {};

    sales.forEach(sale => {
        const date = sale.dateSold ? sale.dateSold.split('T')[0] : new Date().toISOString().split('T')[0];
        dailyProfits[date] = (dailyProfits[date] || 0) + sale.profit;
    });

    // Sort dates and prepare chart data
    const labels = Object.keys(dailyProfits).sort();
    const data = labels.map(date => dailyProfits[date]);

    // Create new chart
    profitChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Daily Profit',
                data: data,
                backgroundColor: '#4CAF50',
                borderColor: '#388E3C',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value);
                        }
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Profit: ${formatCurrency(context.raw)}`;
                        }
                    }
                }
            }
        }
    });
}

// Notification system
function showNotification(message, isSuccess = true) {
    const notification = document.createElement('div');
    notification.className = `notification ${isSuccess ? 'success' : 'error'}`;
    notification.innerHTML = `
        <span>${isSuccess ? '✓' : '✗'}</span>
        <p>${message}</p>
    `;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Utility functions
function formatDate(dateString) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

function saveData() {
    localStorage.setItem('snackInventory', JSON.stringify(inventory));
}

// Inventory management functions
function getAvailableInventory() {
    const available = {};

    inventory.filter(item => item.isPurchase).forEach(item => {
        const key = item.itemName.toLowerCase();
        available[key] = (available[key] || 0) + item.quantityBought;
    });

    inventory.filter(item => !item.isPurchase).forEach(item => {
        const key = item.itemName.toLowerCase();
        if (available[key] !== undefined) {
            available[key] -= item.quantitySold;
        }
    });

    return available;
}

function updateInventoryHealth() {
    const available = getAvailableInventory();
    const purchaseItems = inventory.filter(item => item.isPurchase);

    const critical = purchaseItems.filter(item =>
        available[item.itemName.toLowerCase()] <= 0
    ).map(item => item.itemName);

    const low = purchaseItems.filter(item =>
        available[item.itemName.toLowerCase()] === 1
    ).map(item => item.itemName);

    const healthy = purchaseItems.filter(item =>
        available[item.itemName.toLowerCase()] > 1
    ).map(item => item.itemName);

    // Update UI elements
    document.getElementById('criticalItems').querySelector('p').textContent = `${critical.length} items`;
    document.getElementById('lowItems').querySelector('p').textContent = `${low.length} items`;
    document.getElementById('healthyItems').querySelector('p').textContent = `${healthy.length} items`;

    document.getElementById('criticalList').innerHTML = critical.map(item => `<div>${item}</div>`).join('');
    document.getElementById('lowList').innerHTML = low.map(item => `<div>${item}</div>`).join('');
    document.getElementById('healthyList').innerHTML = healthy.map(item => `<div>${item}</div>`).join('');
}

function updateDropdown() {
    const dropdown = document.getElementById('soldItem');
    dropdown.innerHTML = '<option value="">Select Item</option>';

    const available = getAvailableInventory();
    const itemGroups = {};

    inventory.filter(item => item.isPurchase).forEach((item, index) => {
        const key = item.itemName.toLowerCase();
        const availableQty = available[key] || 0;

        if (availableQty > 0) {
            if (!itemGroups[key]) {
                itemGroups[key] = {
                    name: item.itemName,
                    indices: [],
                    available: availableQty,
                    cost: item.finalCost
                };
            }
            itemGroups[key].indices.push(index);
        }
    });

    for (const group of Object.values(itemGroups)) {
        const option = document.createElement('option');
        option.value = group.indices.join(',');
        option.textContent = `${group.name} (${group.available} left, Cost: ${formatCurrency(group.cost)})`;
        option.style.color = group.available === 1 ? '#FF9800' : '';
        dropdown.appendChild(option);
    }
}

function renderTable() {
    const tableBody = document.getElementById('tableBody');
    const categoryFilter = document.getElementById('categoryFilter').value;
    const available = getAvailableInventory();

    tableBody.innerHTML = inventory.map(item => {
        if (categoryFilter !== 'all' && item.category !== categoryFilter) return '';

        const remaining = available[item.itemName.toLowerCase()] || 0;
        let status = '';

        if (remaining <= 0) status = 'status-critical">Sold Out';
        else if (remaining === 1) status = 'status-low">Low Stock';
        else status = 'status-good">In Stock';

        // Add weight column after Qty Bought
        return `
            <tr>
                <td>${item.itemName}</td>
                <td><span class="category-tag category-${item.category}">${item.category}</span></td>
                <td>${formatCurrency(item.buyPrice)}</td>
                <td>${item.quantityBought}</td>
                <td>${item.weight ? item.weight : '-'}</td>
                <td>${item.isPurchase ? remaining : '-'} ${item.isPurchase ? `<span class="status-badge ${status}</span>` : ''}</td>
                <td>${item.isPurchase ? formatDate(item.datePurchased) : '-'}</td>
                <td>${formatCurrency(item.finalCost)}</td>
                <td>${!item.isPurchase ? formatCurrency(item.sellPrice) : '-'}</td>
                <td>${!item.isPurchase ? item.quantitySold : '-'}</td>
                <td>${!item.isPurchase ? formatDate(item.dateSold) : '-'}</td>
                <td>${!item.isPurchase ? formatCurrency(item.profit) : '-'}</td>
                <td>${!item.isPurchase ? item.customer : '-'}</td>
            </tr>
        `;
    }).join('');

    updateInventoryHealth();
}

// Form handling functions
function resetForms() {
    document.getElementById('itemName').value = '';
    document.getElementById('buyPrice').value = '';
    document.getElementById('quantityBought').value = '1';
    document.getElementById('weight').value = ''; // Reset weight
    document.getElementById('restockThreshold').value = '1';
    document.getElementById('discount').value = '';
    document.getElementById('datePurchased').valueAsDate = new Date();

    document.getElementById('sellPrice').value = '';
    document.getElementById('quantitySold').value = '1';
    document.getElementById('customer').value = '';
    document.getElementById('dateSold').valueAsDate = new Date();

    updateDropdown();
}

function addPurchase() {
    const fields = {
        'item name': document.getElementById('itemName'),
        'buy price': document.getElementById('buyPrice'),
        'quantity': document.getElementById('quantityBought'),
        'weight': document.getElementById('weight'),
        'date purchased': document.getElementById('datePurchased')
    };

    if (!validateForm(fields)) return;

    const itemName = fields['item name'].value;
    const category = document.getElementById('category').value;
    const buyPrice = parseFloat(fields['buy price'].value);
    const quantityBought = parseInt(fields['quantity'].value) || 1;
    const weight = parseInt(fields['weight'].value) || 0;
    const restockThreshold = parseInt(document.getElementById('restockThreshold').value) || 1;
    const discount = parseFloat(document.getElementById('discount').value) || 0;
    const discountType = document.getElementById('discountType').value;
    const datePurchased = fields['date purchased'].value || new Date().toISOString().split('T')[0];

    let finalCost;
    if (discountType === 'percent') {
        finalCost = buyPrice * (1 - discount / 100);
    } else {
        finalCost = buyPrice - discount;
    }

    if (finalCost <= 0) {
        showNotification("Final cost cannot be negative", false);
        return;
    }

    inventory.push({
        itemName: itemName.charAt(0).toUpperCase() + itemName.slice(1),
        category,
        buyPrice,
        quantityBought,
        weight, // Store weight
        restockThreshold,
        datePurchased,
        discount: `${discount}${discountType === 'percent' ? '%' : '$'}`,
        finalCost,
        sellPrice: null,
        quantitySold: 0,
        dateSold: null,
        profit: null,
        customer: null,
        isPurchase: true
    });

    saveData();
    updateDropdown();
    renderTable();
    updateProfitChart();
    showNotification('Purchase added successfully!');
    resetForms();
}

/*********** RECORD SALE FUNCTION (FIXED, with Weight) START ***********/
function recordSale() {
    const fields = {
        'item': document.getElementById('soldItem'),
        'sell price': document.getElementById('sellPrice'),
        'quantity': document.getElementById('quantitySold'),
        'date sold': document.getElementById('dateSold')
    };

    if (!validateForm(fields)) return;

    const selectedIndices = fields['item'].value.split(',');
    const sellPrice = parseFloat(fields['sell price'].value);
    const quantitySold = parseInt(fields['quantity'].value) || 1;
    const customer = document.getElementById('customer').value;
    const dateSold = fields['date sold'].value || new Date().toISOString().split('T')[0];

    const purchaseItem = inventory[selectedIndices[0]];

    // Calculate profit using per-item cost
    const perItemCost = purchaseItem.finalCost / purchaseItem.quantityBought;
    const profitPerUnit = sellPrice - perItemCost;
    const totalProfit = profitPerUnit * quantitySold;

    inventory.push({
        itemName: purchaseItem.itemName,
        category: purchaseItem.category,
        buyPrice: purchaseItem.buyPrice,
        quantityBought: quantitySold,
        weight: purchaseItem.weight, // Add weight to sale record
        finalCost: perItemCost * quantitySold,
        sellPrice: sellPrice,
        quantitySold: quantitySold,
        dateSold: dateSold,
        profit: parseFloat(totalProfit.toFixed(2)),
        customer: customer.charAt(0).toUpperCase() + customer.slice(1),
        isPurchase: false
    });

    saveData();
    updateDropdown();
    renderTable();
    updateProfitChart();
    showNotification(`Sale recorded! Profit: ${formatCurrency(totalProfit)}`);
    resetForms();
}
/*********** RECORD SALE FUNCTION (FIXED, with Weight) END ***********/

function clearHistory() {
    if (confirm("⚠️ Delete ALL history? This cannot be undone!")) {
        inventory = [];
        localStorage.removeItem('snackInventory');
        resetForms();
        updateDropdown();
        renderTable();
        updateProfitChart();
        showNotification('All data has been cleared');
    }
}

window.onload = init;