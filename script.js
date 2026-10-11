/* =========================================================
   SUBTRACK - SUPABASE VERSION
   Subscription data is stored in Supabase, not localStorage.
========================================================= */

let subscriptions = [];
let currentUser = null;
let categoryChartInstance = null;
let billingChartInstance = null;

/* =========================================================
   BASIC HELPERS
========================================================= */

function money(amount) {
    return "₹" + Number(amount || 0).toFixed(2);
}

function getMonthlyCost(item) {
    const cost = Number(item.cost || 0);
    return item.billing === "Yearly" ? cost / 12 : cost;
}

function getTotalMonthlyCost() {
    return subscriptions.reduce(function (total, item) {
        return total + getMonthlyCost(item);
    }, 0);
}

function formatDate(dateString) {
    if (!dateString) return "";

    const date = new Date(dateString + "T00:00:00");

    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function getDaysLeft(dateString) {
    if (!dateString) return 9999;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const renewalDate = new Date(dateString + "T00:00:00");

    return Math.ceil(
        (renewalDate.getTime() - today.getTime()) /
        (1000 * 60 * 60 * 24)
    );
}

function getServiceIcon(name) {
    const value = String(name || "").toLowerCase();

    if (value.includes("netflix")) return "🎬";
    if (value.includes("spotify")) return "🎵";
    if (value.includes("youtube")) return "▶️";
    if (value.includes("amazon") || value.includes("prime")) return "📦";
    if (value.includes("google")) return "🔵";
    if (value.includes("microsoft")) return "💻";
    if (value.includes("adobe")) return "🎨";
    if (value.includes("github")) return "🐙";
    if (value.includes("chatgpt")) return "🤖";

    return "💳";
}

/* Convert database column names to the names used by the UI. */
function fromDatabase(row) {
    return {
        id: row.id,
        userId: row.user_id,
        name: row.name,
        category: row.category,
        cost: Number(row.cost),
        billing: row.billing_cycle,
        date: row.next_billing_date,
        createdAt: row.created_at
    };
}

/* =========================================================
   SUPABASE DATA
========================================================= */

async function loadSubscriptions() {
    const { data, error } = await supabaseClient
        .from("subscriptions")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Could not load subscriptions:", error.message);
        alert("Could not load subscriptions: " + error.message);
        return;
    }

    subscriptions = (data || []).map(fromDatabase);

    updateAll();
}

async function addSubscriptionToDatabase(subscription) {
    const { data, error } = await supabaseClient
        .from("subscriptions")
        .insert({
            user_id: currentUser.id,
            name: subscription.name,
            category: subscription.category,
            cost: subscription.cost,
            billing_cycle: subscription.billing,
            next_billing_date: subscription.date
        })
        .select()
        .single();

    if (error) {
        console.error("Add error:", error.message);
        alert("Could not add subscription: " + error.message);
        return false;
    }

    subscriptions.unshift(fromDatabase(data));
    return true;
}

async function deleteSubscriptionFromDatabase(id) {
    const { error } = await supabaseClient
        .from("subscriptions")
        .delete()
        .eq("id", id);

    if (error) {
        console.error("Delete error:", error.message);
        alert("Could not delete subscription: " + error.message);
        return false;
    }

    subscriptions = subscriptions.filter(function (item) {
        return item.id !== id;
    });

    return true;
}

async function updateSubscriptionInDatabase(id, values) {
    const { data, error } = await supabaseClient
        .from("subscriptions")
        .update({
            name: values.name,
            cost: values.cost,
            next_billing_date: values.date
        })
        .eq("id", id)
        .select()
        .single();

    if (error) {
        console.error("Update error:", error.message);
        alert("Could not update subscription: " + error.message);
        return false;
    }

    const index = subscriptions.findIndex(function (item) {
        return item.id === id;
    });

    if (index !== -1) {
        subscriptions[index] = fromDatabase(data);
    }

    return true;
}

/* =========================================================
   ADD SUBSCRIPTION
========================================================= */

const subscriptionForm =
    document.getElementById("subscriptionForm");

if (subscriptionForm) {
    subscriptionForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const name =
            document.getElementById("subscriptionName").value.trim();

        const category =
            document.getElementById("category").value;

        const cost =
            Number(document.getElementById("cost").value);

        const billing =
            document.getElementById("billingCycle").value;

        const date =
            document.getElementById("billingDate").value;

        if (!name || cost <= 0 || !date) {
            alert("Please enter valid subscription details.");
            return;
        }

        const button =
            subscriptionForm.querySelector("button[type='submit']");

        button.disabled = true;
        button.textContent = "Saving...";

        const success = await addSubscriptionToDatabase({
            name,
            category,
            cost,
            billing,
            date
        });

        button.disabled = false;
        button.textContent = "Add Subscription";

        if (!success) return;

        subscriptionForm.reset();

        alert("Subscription added successfully!");

        updateAll();
    });
}

/* =========================================================
   DISPLAY SUBSCRIPTIONS
========================================================= */

function displaySubscriptions() {
    const list = document.getElementById("subscriptionList");

    if (!list) return;

    const searchInput = document.getElementById("searchInput");
    const categoryFilter = document.getElementById("filterCategory");
    const billingFilter = document.getElementById("filterBilling");

    const search =
        searchInput ? searchInput.value.toLowerCase().trim() : "";

    const category =
        categoryFilter ? categoryFilter.value : "All";

    const billing =
        billingFilter ? billingFilter.value : "All";

    const filtered = subscriptions.filter(function (item) {
        const matchesSearch =
            item.name.toLowerCase().includes(search);

        const matchesCategory =
            category === "All" || item.category === category;

        const matchesBilling =
            billing === "All" || item.billing === billing;

        return matchesSearch && matchesCategory && matchesBilling;
    });

    if (filtered.length === 0) {
        list.innerHTML = '<p class="empty-state">No subscriptions found.</p>';
        return;
    }

    list.innerHTML = filtered.map(function (item) {
        return `
            <div class="subscription">
                <div class="service-icon">
                    ${getServiceIcon(item.name)}
                </div>

                <div class="service-info">
                    <strong>${escapeHtml(item.name)}</strong>
                    <span>${escapeHtml(item.category)} • ${item.billing}</span>
                    <small>Next billing: ${formatDate(item.date)}</small>
                </div>

                <div class="service-price">
                    <strong>${money(item.cost)}</strong>
                    <span>${item.billing === "Monthly" ? "per month" : "per year"}</span>
                </div>

                <div class="action-buttons">
                    <button
                        class="edit-btn"
                        onclick="editSubscription('${item.id}')">
                        ✏️
                    </button>

                    <button
                        class="delete-btn"
                        onclick="deleteSubscription('${item.id}')">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    }).join("");
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

/* =========================================================
   DELETE
========================================================= */

async function deleteSubscription(id) {
    const confirmed = confirm(
        "Are you sure you want to delete this subscription?"
    );

    if (!confirmed) return;

    const success = await deleteSubscriptionFromDatabase(id);

    if (success) {
        updateAll();
    }
}

/* =========================================================
   EDIT
========================================================= */

async function editSubscription(id) {
    const item = subscriptions.find(function (subscription) {
        return subscription.id === id;
    });

    if (!item) return;

    const newName = prompt(
        "Enter subscription name:",
        item.name
    );

    if (newName === null) return;

    const newCost = prompt(
        "Enter cost:",
        item.cost
    );

    if (newCost === null) return;

    const newDate = prompt(
        "Enter billing date (YYYY-MM-DD):",
        item.date
    );

    if (newDate === null) return;

    const cost = Number(newCost);

    if (!newName.trim() || cost <= 0 || !newDate) {
        alert("Please enter valid details.");
        return;
    }

    const success = await updateSubscriptionInDatabase(id, {
        name: newName.trim(),
        cost,
        date: newDate
    });

    if (success) {
        updateAll();
    }
}

/* =========================================================
   DASHBOARD SUMMARY
========================================================= */

function updateSummary() {
    const monthlyCost =
        document.getElementById("monthlyCost");

    const yearlyCost =
        document.getElementById("yearlyCost");

    const activeCount =
        document.getElementById("activeCount");

    let monthlyTotal = 0;
    let yearlyTotal = 0;

    subscriptions.forEach(function (item) {
        if (item.billing === "Monthly") {
            monthlyTotal += Number(item.cost);
        } else {
            yearlyTotal += Number(item.cost);
        }
    });

    if (monthlyCost) {
        monthlyCost.textContent = money(monthlyTotal);
    }

    if (yearlyCost) {
        yearlyCost.textContent = money(yearlyTotal);
    }

    if (activeCount) {
        activeCount.textContent = subscriptions.length;
    }

    updateBudget();
    updateSavingSuggestion();
}

/* =========================================================
   DASHBOARD SUBSCRIPTIONS
========================================================= */

function displayDashboardSubscriptions() {
    const box =
        document.getElementById("dashboardSubscriptions");

    if (!box) return;

    if (subscriptions.length === 0) {
        box.innerHTML =
            '<p class="empty-state">No subscriptions added yet.</p>';
        return;
    }

    const latest = subscriptions.slice(0, 5);

    box.innerHTML = latest.map(function (item) {
        return `
            <div class="subscription">
                <div class="service-icon">
                    ${getServiceIcon(item.name)}
                </div>

                <div class="service-info">
                    <strong>${escapeHtml(item.name)}</strong>
                    <span>${escapeHtml(item.category)}</span>
                </div>

                <div class="service-price">
                    <strong>${money(item.cost)}</strong>
                    <span>${item.billing}</span>
                </div>
            </div>
        `;
    }).join("");
}

/* =========================================================
   DASHBOARD RENEWALS
========================================================= */

function displayDashboardRenewals() {
    const box =
        document.getElementById("dashboardRenewals");

    if (!box) return;

    const upcoming = subscriptions
        .map(function (item) {
            return {
                ...item,
                daysLeft: getDaysLeft(item.date)
            };
        })
        .filter(function (item) {
            return item.daysLeft >= 0;
        })
        .sort(function (a, b) {
            return a.daysLeft - b.daysLeft;
        })
        .slice(0, 5);

    if (upcoming.length === 0) {
        box.innerHTML =
            '<p class="empty-state">No upcoming renewals.</p>';
        return;
    }

    box.innerHTML = upcoming.map(function (item) {
        let message = item.daysLeft + " days left";

        if (item.daysLeft === 0) message = "Renewing today";
        if (item.daysLeft === 1) message = "1 day left";

        return `
            <div class="renewal-item">
                <div>
                    <strong>${escapeHtml(item.name)}</strong>
                    <span>${formatDate(item.date)} • ${money(item.cost)}</span>
                </div>

                <div class="renewal-date">
                    ${message}
                </div>
            </div>
        `;
    }).join("");
}

/* =========================================================
   ANALYTICS
========================================================= */


function displayAnalytics() {
    const categoryBox = document.getElementById("categoryBreakdown");
    const billingBox = document.getElementById("billingBreakdown");
    const categoryCanvas = document.getElementById("categoryChart");
    const billingCanvas = document.getElementById("billingChart");

    if (!categoryBox && !billingBox && !categoryCanvas && !billingCanvas) {
        return;
    }

    if (subscriptions.length === 0) {
        if (categoryBox) {
            categoryBox.innerHTML =
                '<p class="empty-state">Add subscriptions to see analytics.</p>';
        }

        if (billingBox) {
            billingBox.innerHTML =
                '<p class="empty-state">Add subscriptions to see billing costs.</p>';
        }

        if (categoryChartInstance) {
            categoryChartInstance.destroy();
            categoryChartInstance = null;
        }

        if (billingChartInstance) {
            billingChartInstance.destroy();
            billingChartInstance = null;
        }

        return;
    }

    const categories = {};

    subscriptions.forEach(function (item) {
        const category = item.category || "Other";
        categories[category] =
            (categories[category] || 0) + getMonthlyCost(item);
    });

    const categoryNames = Object.keys(categories);
    const categoryAmounts = categoryNames.map(function (category) {
        return categories[category];
    });

    if (categoryBox) {
        const total = getTotalMonthlyCost();

        categoryBox.innerHTML = categoryNames.map(function (category) {
            const amount = categories[category];
            const percentage = total > 0 ? (amount / total) * 100 : 0;

            return `
                <div class="category-row">
                    <div class="category-name">${escapeHtml(category)}</div>
                    <div class="progress">
                        <div class="progress-bar"
                             style="width:${Math.min(percentage, 100)}%">
                        </div>
                    </div>
                    <div class="category-amount">${money(amount)} / month</div>
                </div>
            `;
        }).join("");
    }

    
    if (categoryCanvas && typeof Chart !== "undefined") {
        if (categoryChartInstance) {
            categoryChartInstance.destroy();
        }

        categoryChartInstance = new Chart(categoryCanvas, {
            type: "pie",
            data: {
                labels: categoryNames,
                datasets: [{
                    data: categoryAmounts,
                    backgroundColor: [
                        "#8B5CF6",
                        "#C4B5FD",
                        "#E9D5FF",
                        "#A78BFA",
                        "#6D28D9",
                        "#DDD6FE"
                    ],
                    borderColor: "#FFFFFF",
                    borderWidth: 4,
                    hoverOffset: 12
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: "bottom"
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                return context.label + ": " +
                                    money(context.raw) + " / month";
                            }
                        }
                    }
                }
            }
        });
    }


    if (billingCanvas && typeof Chart !== "undefined") {
        if (billingChartInstance) {
            billingChartInstance.destroy();
        }

        billingChartInstance = new Chart(billingCanvas, {
            type: "bar",
            data: {
                labels: subscriptions.map(function (item) {
                    return item.name;
                }),
                
datasets: [{
    label: "Monthly equivalent (₹)",
    data: subscriptions.map(function (item) {
        return getMonthlyCost(item);
    }),
    backgroundColor: [
        "#B99AFF",
        "#DCC7FF",
        "#F5B8D4"
    ],
    borderColor: [
        "#8B5CF6",
        "#B794F6",
        "#E78AB8"
    ],
    borderWidth: 2,
    borderRadius: 10,
    borderSkipped: false
}]

            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: "Cost (₹ per month)"
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }

    if (billingBox) {
        let monthly = 0;
        let yearly = 0;

        subscriptions.forEach(function (item) {
            if (item.billing === "Monthly") {
                monthly += Number(item.cost);
            } else {
                yearly += Number(item.cost);
            }
        });

        billingBox.innerHTML = `
            <div class="billing-summary">
                <p>Monthly Billing <strong>${money(monthly)}</strong></p>
                <p>Yearly Billing <strong>${money(yearly)}</strong></p>
                <p>Estimated Annual Cost
                    <strong>${money(getTotalMonthlyCost() * 12)}</strong>
                </p>
            </div>
        `;
    }
}


function displayReminders() {
    const box =
        document.getElementById("reminderList");

    if (!box) return;

    const reminders = subscriptions
        .map(function (item) {
            return {
                ...item,
                daysLeft: getDaysLeft(item.date)
            };
        })
        .filter(function (item) {
            return item.daysLeft >= 0 && item.daysLeft <= 30;
        })
        .sort(function (a, b) {
            return a.daysLeft - b.daysLeft;
        });

    if (reminders.length === 0) {
        box.innerHTML =
            '<p class="empty-state">No renewals in the next 30 days.</p>';
        return;
    }

    box.innerHTML = reminders.map(function (item) {
        let message = item.daysLeft + " days left";

        if (item.daysLeft === 0) message = "Renewing today";
        if (item.daysLeft === 1) message = "Tomorrow";

        return `
            <div class="renewal-item">
                <div>
                    <strong>
                        ${getServiceIcon(item.name)}
                        ${escapeHtml(item.name)}
                    </strong>

                    <span>
                        ${escapeHtml(item.category)} •
                        ${money(item.cost)} •
                        ${item.billing}
                    </span>

                    <span>
                        Renewal date: ${formatDate(item.date)}
                    </span>
                </div>

                <div class="renewal-date">
                    ${message}
                </div>
            </div>
        `;
    }).join("");
}

/* =========================================================
   BUDGET
========================================================= */

function getBudgetKey() {
    return currentUser
        ? "budget_" + currentUser.id
        : "budget";
}

function getBudget() {
    return Number(localStorage.getItem(getBudgetKey())) || 5000;
}

function saveBudget(value) {
    localStorage.setItem(getBudgetKey(), value);
}

function updateBudget() {
    const budgetAmount =
        document.getElementById("budgetAmount");

    const budgetSpent =
        document.getElementById("budgetSpent");

    const budgetRemaining =
        document.getElementById("budgetRemaining");

    const budgetProgress =
        document.getElementById("budgetProgress");

    const spendingStatus =
        document.getElementById("spendingStatus");

    if (
        !budgetAmount &&
        !budgetSpent &&
        !budgetRemaining &&
        !budgetProgress &&
        !spendingStatus
    ) {
        return;
    }

    const budget = getBudget();
    const spent = getTotalMonthlyCost();
    const remaining = budget - spent;

    if (budgetAmount) {
        budgetAmount.textContent = money(budget);
    }

    if (budgetSpent) {
        budgetSpent.textContent = money(spent);
    }

    if (budgetRemaining) {
        budgetRemaining.textContent =
            money(Math.max(remaining, 0));
    }

    if (budgetProgress) {
        const percentage =
            budget > 0
                ? Math.min((spent / budget) * 100, 100)
                : 0;

        budgetProgress.style.width = percentage + "%";

        budgetProgress.classList.toggle(
            "over-budget",
            spent > budget
        );
    }

    if (spendingStatus) {
        if (spent > budget) {
            spendingStatus.textContent =
                "🔴 You are over budget";
        } else if (spent >= budget * 0.8) {
            spendingStatus.textContent =
                "🟡 Spending is getting high";
        } else {
            spendingStatus.textContent =
                "🟢 Low spending";
        }
    }
}

const setBudgetBtn =
    document.getElementById("setBudgetBtn");

if (setBudgetBtn) {
    setBudgetBtn.addEventListener("click", function () {
        const currentBudget = getBudget();

        let newBudget = prompt(
            "Enter your monthly budget:",
            currentBudget
        );

        if (newBudget === null) return;

        newBudget = Number(newBudget);

        if (isNaN(newBudget) || newBudget <= 0) {
            alert("Please enter a valid budget.");
            return;
        }

        saveBudget(newBudget);
        updateBudget();
    });
}

/* =========================================================
   SMART SAVING TIP
========================================================= */

function updateSavingSuggestion() {
    const suggestion =
        document.getElementById("savingSuggestion");

    if (!suggestion) return;

    const budget = getBudget();
    const total = getTotalMonthlyCost();

    if (subscriptions.length === 0) {
        suggestion.textContent =
            "Add subscriptions to get saving suggestions.";
    } else if (total > budget) {
        suggestion.textContent =
            "Your subscription spending is above your monthly budget. Consider cancelling unused subscriptions.";
    } else if (total > budget * 0.8) {
        suggestion.textContent =
            "Your spending is close to your monthly budget. Review subscriptions you rarely use.";
    } else if (subscriptions.length >= 5) {
        suggestion.textContent =
            "You have several active subscriptions. Check whether you are using all of them regularly.";
    } else {
        suggestion.textContent =
            "Your subscription spending is currently under control. Keep reviewing your subscriptions regularly.";
    }
}

/* =========================================================
   DARK MODE
========================================================= */

function applyDarkMode() {
    const isDark =
        localStorage.getItem("darkMode") === "true";

    document.body.classList.toggle("dark", isDark);

    const button =
        document.getElementById("darkModeBtn");

    if (button) {
        button.textContent = isDark ? "☀️" : "🌙";
    }
}

const darkModeBtn =
    document.getElementById("darkModeBtn");

if (darkModeBtn) {
    darkModeBtn.addEventListener("click", function () {
        const isDark =
            document.body.classList.contains("dark");

        localStorage.setItem(
            "darkMode",
            String(!isDark)
        );

        applyDarkMode();
    });
}

/* =========================================================
   FILTERS
========================================================= */

const searchInput =
    document.getElementById("searchInput");

if (searchInput) {
    searchInput.addEventListener(
        "input",
        displaySubscriptions
    );
}

const filterCategory =
    document.getElementById("filterCategory");

if (filterCategory) {
    filterCategory.addEventListener(
        "change",
        displaySubscriptions
    );
}

const filterBilling =
    document.getElementById("filterBilling");

if (filterBilling) {
    filterBilling.addEventListener(
        "change",
        displaySubscriptions
    );
}

/* =========================================================
   UPDATE EVERYTHING
========================================================= */

function updateAll() {
    updateSummary();
    displaySubscriptions();
    displayDashboardSubscriptions();
    displayDashboardRenewals();
    displayAnalytics();
    displayReminders();
    renderSubscriptionCharts();
}

/* =========================================================
   INITIAL LOAD
========================================================= */

applyDarkMode();

(async function startApp() {
    currentUser = await getCurrentUser();

    if (!currentUser) return;

    await loadSubscriptions();
})();