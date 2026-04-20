/* =========================================================
   Lost & Found — script.js  (Supabase Edition)

   IMPORTANT — Run these in Supabase SQL Editor before using:
   ─────────────────────────────────────────────────────────
   ALTER TABLE users    ADD COLUMN IF NOT EXISTS password text;
   ALTER TABLE items    ADD COLUMN IF NOT EXISTS item_type text;
   ALTER TABLE requests ADD COLUMN IF NOT EXISTS item_type text;
   ALTER TABLE claims   ADD COLUMN IF NOT EXISTS item_type text;
   ─────────────────────────────────────────────────────────
   ========================================================= */

const ADMIN_EMAIL      = "admin@admin.com";
const ADMIN_PASSWORD   = "admin123";
const STORAGE_USER     = "lf_user";       // session only — stays in localStorage
const STORAGE_ACTIVITY = "lf_activity";   // activity log — local only

/* ════════════════════════════════════════════════════════
   SESSION  (localStorage — keeps user logged in across pages)
   ════════════════════════════════════════════════════════ */
function getCurrentUser() {
    try { return JSON.parse(localStorage.getItem(STORAGE_USER)) ?? null; }
    catch { return null; }
}
function setCurrentUser(u) { localStorage.setItem(STORAGE_USER, JSON.stringify(u)); }

function ensureLogin(role) {
    const user = getCurrentUser();
    if (!user) { window.location.href = "login.html"; return null; }
    if (role && user.role !== role) {
        window.location.href = user.role === "admin" ? "adminpage.html" : "memberpage.html";
        return null;
    }
    return user;
}

function logout() {
    showConfirm("Sign Out", "Are you sure you want to sign out of your account?", "Sign Out", true, () => {
        localStorage.removeItem(STORAGE_USER);
        window.location.href = "login.html";
    });
}

/* ════════════════════════════════════════════════════════
   DB NORMALIZERS  (Supabase snake_case → JS camelCase)
   ════════════════════════════════════════════════════════ */
const toItem    = r => ({ id:r.id, name:r.name, category:r.category, itemType:r.item_type,  description:r.description, location:r.location, date:r.date, contact:r.contact, status:r.status });
const toRequest = r => ({ id:r.id, name:r.name, category:r.category, itemType:r.item_type,  description:r.description, location:r.location, date:r.date, contact:r.contact, requestedBy:r.requested_by, status:r.status });
const toClaim   = r => ({ id:r.id, itemId:r.item_id, name:r.name, category:r.category, itemType:r.item_type, description:r.description, location:r.location, date:r.date, contact:r.contact, requestedBy:r.requested_by, status:r.status });
const toUser    = r => ({ id:r.id, email:r.email, name:r.name, role:r.role, password:r.password, joinedAt:r.created_at });

/* ════════════════════════════════════════════════════════
   DB: ITEMS
   ════════════════════════════════════════════════════════ */
async function dbGetItems() {
    const { data, error } = await supabaseClient.from("items").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).map(toItem);
}
async function dbInsertItem(item) {
    const { error } = await supabaseClient.from("items").insert([{
        id: item.id, name: item.name, category: item.category, item_type: item.itemType,
        description: item.description, location: item.location, date: item.date,
        contact: item.contact, status: "Approved"
    }]);
    if (error) throw error;
}
async function dbUpdateItem(id, fields) {
    const map = {};
    if (fields.name        !== undefined) map.name        = fields.name;
    if (fields.category    !== undefined) map.category    = fields.category;
    if (fields.description !== undefined) map.description = fields.description;
    if (fields.location    !== undefined) map.location    = fields.location;
    if (fields.contact     !== undefined) map.contact     = fields.contact;
    if (fields.status      !== undefined) map.status      = fields.status;
    if (fields.itemType    !== undefined) map.item_type   = fields.itemType;
    const { error } = await supabaseClient.from("items").update(map).eq("id", id);
    if (error) throw error;
}
async function dbDeleteItem(id) {
    const { error } = await supabaseClient.from("items").delete().eq("id", id);
    if (error) throw error;
}

/* ════════════════════════════════════════════════════════
   DB: REQUESTS
   ════════════════════════════════════════════════════════ */
async function dbGetRequests(userEmail = null) {
    let q = supabaseClient.from("requests").select("*").order("created_at", { ascending: false });
    if (userEmail) q = q.eq("requested_by", userEmail);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []).map(toRequest);
}
async function dbInsertRequest(req) {
    const { error } = await supabaseClient.from("requests").insert([{
        id: req.id, name: req.name, category: req.category, item_type: req.itemType,
        description: req.description, location: req.location, date: req.date,
        contact: req.contact, requested_by: req.requestedBy, status: "pending"
    }]);
    if (error) throw error;
}
async function dbUpdateRequestStatus(id, status) {
    const { error } = await supabaseClient.from("requests").update({ status }).eq("id", id);
    if (error) throw error;
}

/* ════════════════════════════════════════════════════════
   DB: CLAIMS
   ════════════════════════════════════════════════════════ */
async function dbGetClaims(userEmail = null) {
    let q = supabaseClient.from("claims").select("*").order("created_at", { ascending: false });
    if (userEmail) q = q.eq("requested_by", userEmail);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []).map(toClaim);
}
async function dbInsertClaim(claim) {
    const { error } = await supabaseClient.from("claims").insert([{
        id: claim.id, item_id: claim.itemId, name: claim.name,
        category: claim.category, item_type: claim.itemType,
        description: claim.description, location: claim.location,
        date: claim.date, contact: claim.contact,
        requested_by: claim.requestedBy, status: "pending"
    }]);
    if (error) throw error;
}
async function dbUpdateClaimStatus(id, status) {
    const { error } = await supabaseClient.from("claims").update({ status }).eq("id", id);
    if (error) throw error;
}

/* ════════════════════════════════════════════════════════
   DB: USERS
   ════════════════════════════════════════════════════════ */
async function dbGetUsers() {
    const { data, error } = await supabaseClient.from("users").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).map(toUser);
}
async function dbGetUserByEmail(email) {
    const { data, error } = await supabaseClient
        .from("users").select("*").eq("email", email.toLowerCase()).maybeSingle();
    if (error) throw error;
    return data ? toUser(data) : null;
}
async function dbInsertUser(user) {
    const { error } = await supabaseClient.from("users").insert([{
        // We removed 'id: user.id' here so Supabase can auto-generate the UUID
        email: user.email.toLowerCase(),
        name: user.name, 
        role: "member", 
        password: user.password
    }]);
    if (error) throw error;
}
async function dbDeleteUser(email) {
    const { error } = await supabaseClient.from("users").delete().eq("email", email.toLowerCase());
    if (error) throw error;
}

/* ════════════════════════════════════════════════════════
   DB: MESSAGES (CHAT)
   ════════════════════════════════════════════════════════ */

// 1. Fetch the chat history between two specific people
async function dbGetMessages(userEmail1, userEmail2) {
    const { data, error } = await supabaseClient
        .from("messages")
        .select("*")
        // Get messages where user1 is sender & user2 is receiver, OR vice versa
        .or(`and(sender_email.eq.${userEmail1},receiver_email.eq.${userEmail2}),and(sender_email.eq.${userEmail2},receiver_email.eq.${userEmail1})`)
        .order("created_at", { ascending: true }); // Oldest to newest
    if (error) throw error;
    return data || [];
}

// 2. Send a new message
async function dbSendMessage(sender, receiver, content) {
    const { error } = await supabaseClient.from("messages").insert([{
        sender_email: sender, 
        receiver_email: receiver, 
        content: content
    }]);
    if (error) throw error;
}

// 3. The Realtime Listener
function subscribeToMessages(currentUserEmail, onNewMessage) {
    // Listen for any new row added to the messages table
    supabaseClient
        .channel('chat-room')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
            const newMsg = payload.new;
            // Only trigger the UI update if this message involves the logged-in user
            if (newMsg.sender_email === currentUserEmail || newMsg.receiver_email === currentUserEmail) {
                onNewMessage(newMsg);
            }
        })
        .subscribe();
}
async function dbGetChatRequests() {
    const { data, error } = await supabaseClient.from("chat_requests").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
}
async function dbUpdateChatRequestStatus(id, status) {
    const { error } = await supabaseClient.from("chat_requests").update({ status }).eq("id", id);
    if (error) throw error;
}

/* ════════════════════════════════════════════════════════
   ACTIVITY LOG  (localStorage — per-device, admin only)
   ════════════════════════════════════════════════════════ */
const ACTIVITY_ICONS = {
    signup:           "<i class='ph ph-user-plus'></i>",
    login:            "<i class='ph ph-sign-in'></i>",
    post_request:     "<i class='ph ph-file-text'></i>",
    post_approved:    "<i class='ph ph-check-circle'></i>",
    post_rejected:    "<i class='ph ph-x-circle'></i>",
    claim_request:    "<i class='ph ph-hand-grabbing'></i>",
    claim_approved:   "<i class='ph ph-check-circle'></i>",
    claim_rejected:   "<i class='ph ph-x-circle'></i>",
    item_edited:      "<i class='ph ph-pencil-simple'></i>",
    item_deleted:     "<i class='ph ph-trash'></i>",
    activity_cleared: "<i class='ph ph-broom'></i>",
};
function logActivity(type, detail) {
    try {
        const log = JSON.parse(localStorage.getItem(STORAGE_ACTIVITY)) ?? [];
        log.unshift({ id:`act-${Date.now()}`, type, detail, timestamp: new Date().toISOString() });
        localStorage.setItem(STORAGE_ACTIVITY, JSON.stringify(log.slice(0, 200)));
    } catch {}
}

/* ════════════════════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════════════════════ */
function esc(s) {
    if (!s) return "";
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function categoryTag(cat) {
    const cls  = cat === "Lost" ? "tag-lost" : "tag-found";
    const icon = cat === "Lost" ? "<i class='ph ph-map-pin-line'></i>" : "<i class='ph ph-magnifying-glass'></i>";
    return `<span class="tag ${cls}">${icon} ${esc(cat)}</span>`;
}
function statusTag(status) {
    const map = {
        pending:  ["tag-pending",  "<i class='ph ph-hourglass-high'></i> Pending"],
        approved: ["tag-approved", "<i class='ph ph-check-circle'></i> Approved"],
        rejected: ["tag-rejected", "<i class='ph ph-x-circle'></i> Rejected"],
        Approved: ["tag-approved", "<i class='ph ph-check-circle'></i> Approved"],
        Claimed:  ["tag-claimed",  "<i class='ph ph-handshake'></i> Claimed"],
    };
    const [cls, label] = map[status] || ["tag-pending", esc(status)];
    return `<span class="tag ${cls}">${label}</span>`;
}
function itemTypeTag(itemType) {
    if (!itemType) return "";
    return `<span class="tag tag-type">${esc(itemType)}</span>`;
}
function emptyState(msg) { return `<div class="empty-state">${esc(msg)}</div>`; }
function loadingState(msg = "Loading…") { return `<div class="empty-state" style="opacity:.6;">${esc(msg)}</div>`; }
function showMsg(el, msg, type) {
    if (!el) return;
    el.textContent = msg;
    el.className   = type === "error" ? "error-message" : "success-message";
}
/* ════════════════════════════════════════════════════════
   TOAST NOTIFICATIONS
   ════════════════════════════════════════════════════════ */
function showToast(message, type = "success") {
    // Check if container exists; if not, create it dynamically
    let container = document.getElementById("toastContainer");
    if (!container) {
        container = document.createElement("div");
        container.id = "toastContainer";
        document.body.appendChild(container);
    }
    
    // Create the toast
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    
    // Add the icon and message
    const icon = type === "error" ? "<i class='ph ph-warning-circle'></i>" : "<i class='ph ph-check-circle'></i>";
    toast.innerHTML = `${icon} <span>${esc(message)}</span>`;
    
    container.appendChild(toast);
    
    // Auto-remove the toast after the CSS animation finishes (3.9 seconds)
    setTimeout(() => {
        if (toast.parentElement) toast.remove();
    }, 3900);
}

/* ════════════════════════════════════════════════════════
   CONFIRM MODAL
   ════════════════════════════════════════════════════════ */
function showConfirm(title, message, confirmText, isDanger, onConfirm) {
    const overlay  = document.createElement("div");
    overlay.className = "modal";
    overlay.style.zIndex = "1000";
    const btnClass = isDanger ? "danger" : "primary";
    const icon     = isDanger ? "<i class='ph ph-warning-circle'></i>" : "<i class='ph ph-question'></i>";
    overlay.innerHTML = `
        <div class="modal-backdrop"></div>
        <div class="modal-panel" style="max-width:380px;text-align:center;padding:32px 24px;box-shadow:0 20px 60px rgba(0,0,0,0.6);">
            <div style="font-size:3.5rem;color:${isDanger ? "var(--red)" : "var(--accent)"};margin-bottom:12px;animation:scaleIn 0.3s ease;">${icon}</div>
            <h2 style="font-family:var(--font-display);font-size:1.3rem;margin-bottom:8px;">${esc(title)}</h2>
            <p style="color:var(--text-secondary);font-size:0.9rem;margin-bottom:24px;line-height:1.5;">${esc(message)}</p>
            <div style="display:flex;gap:10px;justify-content:center;">
                <button class="button secondary" id="confirmCancel" style="flex:1;">Cancel</button>
                <button class="button ${btnClass}" id="confirmAction" style="flex:1;">${esc(confirmText)}</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    const close = () => { overlay.classList.add("hidden"); setTimeout(() => overlay.remove(), 250); };
    overlay.querySelector("#confirmCancel").onclick  = close;
    overlay.querySelector(".modal-backdrop").onclick = close;
    overlay.querySelector("#confirmAction").onclick  = () => { close(); onConfirm(); };
}

/* ════════════════════════════════════════════════════════
   CARD RENDERERS
   ════════════════════════════════════════════════════════ */
function renderItemCard(item, actionsHtml = "") {
    return `
    <article class="card item-card" data-item-type="${esc(item.itemType||"")}" data-name="${esc((item.name||"").toLowerCase())}">
        <div class="item-header">
            ${categoryTag(item.category)}
            ${itemTypeTag(item.itemType)}
            ${statusTag(item.status || "Approved")}
        </div>
        <h3>${esc(item.name)}</h3>
        <p>${esc(item.description)}</p>
        <dl>
            <div><dt>Location</dt><dd>${esc(item.location)}</dd></div>
            <div><dt>Date</dt><dd>${esc(item.date)}</dd></div>
            <div><dt>Contact</dt><dd>${esc(item.contact)}</dd></div>
        </dl>
        ${actionsHtml}
    </article>`;
}
function renderRequestCard(request, actionsHtml = "") {
    return `
    <article class="card item-card">
        <div class="item-header">
            ${categoryTag(request.category)}
            ${itemTypeTag(request.itemType)}
            ${statusTag(request.status)}
        </div>
        <h3>${esc(request.name)}</h3>
        <p>${esc(request.description)}</p>
        <dl>
            <div><dt>Location</dt><dd>${esc(request.location)}</dd></div>
            <div><dt>Date</dt><dd>${esc(request.date)}</dd></div>
            <div><dt>Contact</dt><dd>${esc(request.contact)}</dd></div>
            <div><dt>Requested by</dt><dd>${esc(request.requestedBy)}</dd></div>
        </dl>
        ${actionsHtml}
    </article>`;
}
function renderClaimCard(claim, actionsHtml = "") {
    return `
    <article class="card item-card">
        <div class="item-header">
            ${categoryTag(claim.category)}
            ${itemTypeTag(claim.itemType)}
            ${statusTag(claim.status)}
        </div>
        <h3>${esc(claim.name)}</h3>
        <p>${esc(claim.description)}</p>
        <dl>
            <div><dt>Location</dt><dd>${esc(claim.location)}</dd></div>
            <div><dt>Date</dt><dd>${esc(claim.date)}</dd></div>
            <div><dt>Contact</dt><dd>${esc(claim.contact)}</dd></div>
            <div><dt>Claimed by</dt><dd>${esc(claim.requestedBy)}</dd></div>
        </dl>
        ${actionsHtml}
    </article>`;
}

/* ════════════════════════════════════════════════════════
   FAB — Floating Action Button
   ════════════════════════════════════════════════════════ */
function toggleFab() {
    const opts = document.getElementById("fabOptions");
    const main = document.getElementById("fabMain");
    if (!opts) return;
    const isOpen = opts.classList.contains("open");
    opts.classList.toggle("open", !isOpen);
    main.classList.toggle("open", !isOpen);
}
function closeFab() {
    document.getElementById("fabOptions")?.classList.remove("open");
    document.getElementById("fabMain")?.classList.remove("open");
}
document.addEventListener("click", e => {
    const fab = document.querySelector(".fab-container");
    if (fab && !fab.contains(e.target)) closeFab();
});

/* ════════════════════════════════════════════════════════
   LOGIN / SIGN UP
   ════════════════════════════════════════════════════════ */
function initLogin() {
    let isLoginDirty = false;
    document.getElementById("loginForm")?.addEventListener("input",  () => isLoginDirty = true);
    document.getElementById("signupForm")?.addEventListener("input", () => isLoginDirty = true);

    document.querySelectorAll(".form-actions a.button.secondary").forEach(btn => {
        btn.addEventListener("click", e => {
            if (isLoginDirty) {
                e.preventDefault();
                showConfirm("Go Back?", "Any info you've entered will be lost. Continue?", "Go Back", true, () => {
                    window.location.href = btn.href;
                });
            }
        });
    });

    document.querySelectorAll(".auth-tab").forEach(tab => {
        tab.addEventListener("click", () => {
            const target = tab.dataset.tab;
            document.querySelectorAll(".auth-tab").forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            document.querySelectorAll(".auth-form").forEach(f => {
                f.classList.toggle("hidden", f.dataset.form !== target);
            });
            const isSignIn = target === "signin";
            const h = document.getElementById("authHeading");
            const p = document.getElementById("authSubheading");
            if (h) h.textContent = isSignIn ? "Welcome back" : "Create account";
            if (p) p.textContent = isSignIn
                ? "Sign in to access the Lost & Found system."
                : "Register to browse and post items.";
        });
    });

    /* ── Sign In ─────────────────────────── */
    document.getElementById("loginForm")?.addEventListener("submit", async e => {
        e.preventDefault();
        const errorEl   = document.getElementById("loginError");
        const submitBtn = e.target.querySelector("button[type=submit]");
        const email     = document.getElementById("email").value.trim();
        const password  = document.getElementById("password").value;
        if (errorEl) { errorEl.textContent = ""; errorEl.className = ""; }
        if (!email || !password) { showMsg(errorEl, "Please enter email and password.", "error"); return; }

        // Hard-coded admin bypass
        if (email.toLowerCase() === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
            setCurrentUser({ email, name: "System Admin", role: "admin" });
            logActivity("login", "Admin signed in");
            window.location.href = "adminpage.html";
            return;
        }

        submitBtn.disabled    = true;
        submitBtn.textContent = "Signing in…";
        try {
            const found = await dbGetUserByEmail(email);
            if (!found)                    { showMsg(errorEl, "No account found with that email. Please sign up first.", "error"); return; }
            if (found.password !== password) { showMsg(errorEl, "Incorrect password.", "error"); return; }
            isLoginDirty = false;
            setCurrentUser({ email: found.email, name: found.name, role: "member" });
            logActivity("login", `${found.name} signed in`);
            window.location.href = "memberpage.html";
        } catch (err) {
            showMsg(errorEl, "Could not connect. Please try again.", "error");
            console.error(err);
        } finally {
            submitBtn.disabled    = false;
            submitBtn.textContent = "Sign In";
        }
    });

    /* ── Sign Up ─────────────────────────── */
    document.getElementById("signupForm")?.addEventListener("submit", async e => {
        e.preventDefault();
        const errEl     = document.getElementById("signupError");
        const succEl    = document.getElementById("signupSuccess");
        const submitBtn = e.target.querySelector("button[type=submit]");
        if (errEl)  { errEl.textContent  = ""; errEl.className  = ""; }
        if (succEl) { succEl.textContent = ""; succEl.className = ""; }

        const firstName = document.getElementById("signupFirstName").value.trim();
        const lastName  = document.getElementById("signupLastName").value.trim();
        const email     = document.getElementById("signupEmail").value.trim();
        const password  = document.getElementById("signupPassword").value;
        const confirm   = document.getElementById("signupConfirm").value;

        if (!firstName||!lastName||!email||!password||!confirm) { showMsg(errEl,"Please fill in all fields.","error"); return; }
        if (password.length < 6)   { showMsg(errEl, "Password must be at least 6 characters.", "error"); return; }
        if (password !== confirm)  { showMsg(errEl, "Passwords do not match.", "error"); return; }
        if (email.toLowerCase() === ADMIN_EMAIL) { showMsg(errEl, "That email is reserved.", "error"); return; }

        submitBtn.disabled    = true;
        submitBtn.textContent = "Creating account…";
        try {
            const existing = await dbGetUserByEmail(email);
            if (existing) { showMsg(errEl, "An account with that email already exists.", "error"); return; }

            const newUser = { id:`usr-${Date.now()}`, email, name:`${firstName} ${lastName}`, password, role:"member" };
            await dbInsertUser(newUser);
            logActivity("signup", `${newUser.name} created an account`);

            isLoginDirty = false;
            document.getElementById("signupForm").reset();
            showMsg(succEl, "Account created! You can now sign in.", "success");
            setTimeout(() => {
                document.querySelector('.auth-tab[data-tab="signin"]')?.click();
                const emailEl = document.getElementById("email");
                if (emailEl) emailEl.value = email;
            }, 1400);
        } catch (err) {
            showMsg(errEl, "Could not create account. Please try again.", "error");
            console.error(err);
        } finally {
            submitBtn.disabled    = false;
            submitBtn.textContent = "Sign Up";
        }
    });
}

/* ════════════════════════════════════════════════════════
   MEMBER PAGE
   ════════════════════════════════════════════════════════ */
let _memberCatFilter = "all";

async function initMemberPage() {
    const user = ensureLogin("member");
    if (!user) return;

    const nameEl   = document.getElementById("memberName");
    const avatarEl = document.getElementById("memberAvatar");
    if (nameEl)   nameEl.textContent   = user.name;
    if (avatarEl) avatarEl.textContent = (user.name || "M").slice(0, 2).toUpperCase();
    document.getElementById("logoutBtn").onclick = logout;

    document.querySelectorAll(".nav-link[data-section]").forEach(link => {
        link.addEventListener("click", e => {
            e.preventDefault();
            switchMemberSection(link.dataset.section);
        });
    });

    document.querySelectorAll("#catFilter .cat-pill").forEach(pill => {
        pill.addEventListener("click", () => {
            document.querySelectorAll("#catFilter .cat-pill").forEach(p => p.classList.remove("active"));
            pill.classList.add("active");
            _memberCatFilter = pill.dataset.cat;
            const otherWrap = document.getElementById("otherFilterWrap");
            if (_memberCatFilter === "Other") {
                otherWrap?.classList.remove("hidden");
                document.getElementById("otherFilterText")?.focus();
            } else {
                otherWrap?.classList.add("hidden");
            }
            filterMemberItems();
        });
    });

    await renderMemberSection(user);
}

async function switchMemberSection(section) {
    document.querySelectorAll(".nav-link[data-section]").forEach(l =>
        l.classList.toggle("active", l.dataset.section === section)
    );
    document.querySelectorAll(".admin-section").forEach(s =>
        s.classList.toggle("hidden", s.id !== `section-${section}`)
    );
    const user = getCurrentUser();
    if (!user) return;
    if (section === "items")    await renderAvailableItems(user);
    if (section === "claims")   await renderMyClaims(user);
    if (section === "requests") await renderMyRequests(user);
    if (section === "conversations") await renderResolutions();
}

async function renderMemberSection(user) {
    // Show loading states immediately
    const itemsEl    = document.getElementById("itemsList");
    const claimsEl   = document.getElementById("myClaims");
    const requestsEl = document.getElementById("myRequests");
    if (itemsEl)    itemsEl.innerHTML    = loadingState("Loading items…");
    if (claimsEl)   claimsEl.innerHTML   = loadingState("Loading claims…");
    if (requestsEl) requestsEl.innerHTML = loadingState("Loading requests…");

    try {
        const [items, claims, requests] = await Promise.all([
            dbGetItems(),
            dbGetClaims(user.email),
            dbGetRequests(user.email),
        ]);
        _renderAvailableItems(items, claims, user);
        _renderMyClaims(claims, user);
        _renderMyRequests(requests);
    } catch (err) {
        console.error("Failed to load member data:", err);
        if (itemsEl) itemsEl.innerHTML = emptyState("Could not load items. Please refresh.");
    }
}

async function renderAvailableItems(user) {
    const listEl = document.getElementById("itemsList");
    if (listEl) listEl.innerHTML = loadingState("Loading items…");
    try {
        const [items, claims] = await Promise.all([dbGetItems(), dbGetClaims(user.email)]);
        _renderAvailableItems(items, claims, user);
    } catch (err) {
        console.error(err);
        if (listEl) listEl.innerHTML = emptyState("Could not load items.");
    }
}

function _renderAvailableItems(items, claims, user) {
    const approved = items.filter(i => i.status === "Approved");
    const countEl  = document.getElementById("itemsCountLabel");
    const listEl   = document.getElementById("itemsList");
    const badge    = document.getElementById("itemsBadge");

    if (badge)  { badge.textContent = approved.length; badge.classList.toggle("hidden", approved.length === 0); }
    if (countEl) countEl.textContent = `${approved.length} item${approved.length !== 1 ? "s" : ""} available`;
    if (!listEl) return;

    listEl.innerHTML = approved.length
        ? approved.map(item => renderItemCard(item, generateClaimAction(item, claims, user))).join("")
        : emptyState("No items are currently available. Use the + button to report one.");

    listEl.querySelectorAll(".claim-button").forEach(btn =>
        btn.addEventListener("click", () => handleClaim(btn.dataset.id, user))
    );
    filterMemberItems();
}

function generateClaimAction(item, claims, user) {
    const already = claims.some(c => c.itemId === item.id && c.requestedBy === user.email && c.status === "pending");
    if (item.status !== "Approved") return "";
    if (already) return `<div class="request-actions"><span class="tag tag-pending"><i class="ph ph-hourglass-high"></i> Claim Pending</span></div>`;
    return `<div class="request-actions">
        <button class="button primary sm claim-button" data-id="${esc(item.id)}" type="button">Request Claim</button>
    </div>`;
}

async function handleClaim(itemId, user) {
    try {
        const items = await dbGetItems();
        const item  = items.find(e => e.id === itemId);
        if (!item) return;

        showConfirm("Request Claim", `Are you sure you want to submit a claim for "${item.name}"?`, "Submit Claim", false, async () => {
            try {
                await dbInsertClaim({
                    id: `claim-${Date.now()}`, itemId,
                    name: item.name, category: item.category, itemType: item.itemType,
                    description: item.description, location: item.location,
                    date: item.date, contact: item.contact,
                    requestedBy: user.email, status: "pending"
                });
                logActivity("claim_request", `${user.email} requested claim on "${item.name}"`);
                const noticeEl = document.getElementById("memberNotice");
                if (noticeEl) {
                    noticeEl.textContent = "Claim submitted! Admin will review it shortly.";
                    noticeEl.classList.remove("visually-hidden");
                    setTimeout(() => noticeEl.classList.add("visually-hidden"), 5000);
                }
                await renderAvailableItems(user);
                await renderMyClaims(user);
            } catch (err) {
                console.error("Claim failed:", err);
                showToast("Could not submit claim. Please try again.");
            }
        });
    } catch (err) { console.error(err); }
}

async function renderMyClaims(user) {
    const claimsEl = document.getElementById("myClaims");
    if (claimsEl) claimsEl.innerHTML = loadingState("Loading claims…");
    try {
        const claims = await dbGetClaims(user.email);
        _renderMyClaims(claims, user);
    } catch (err) {
        console.error(err);
        if (claimsEl) claimsEl.innerHTML = emptyState("Could not load claims.");
    }
}

function _renderMyClaims(claims, user) {
    const pending = claims.filter(c => c.status === "pending");
    const badge   = document.getElementById("claimsBadge");
    if (badge) { badge.textContent = pending.length; badge.classList.toggle("hidden", pending.length === 0); }

    const el = document.getElementById("myClaims");
    if (!el) return;
    el.innerHTML = claims.length
        ? claims.map(c => renderClaimCard(c)).join("")
        : emptyState("You haven't submitted any claim requests yet.");

    const noticeEl = document.getElementById("memberNotice");
    if (noticeEl && pending.length) {
        noticeEl.textContent = `You have ${pending.length} pending claim${pending.length > 1 ? "s" : ""}. Admin will review soon.`;
        noticeEl.classList.remove("visually-hidden");
    }
}

async function renderMyRequests(user) {
    const reqEl = document.getElementById("myRequests");
    if (reqEl) reqEl.innerHTML = loadingState("Loading requests…");
    try {
        const requests = await dbGetRequests(user.email);
        _renderMyRequests(requests);
    } catch (err) {
        console.error(err);
        if (reqEl) reqEl.innerHTML = emptyState("Could not load requests.");
    }
}

function _renderMyRequests(requests) {
    const el = document.getElementById("myRequests");
    if (!el) return;
    el.innerHTML = requests.length
        ? requests.map(r => renderRequestCard(r)).join("")
        : emptyState("You haven't submitted any post requests yet. Tap the + button to get started.");
}

function filterMemberItems() {
    const searchEl  = document.getElementById("memberSearch");
    const q         = (searchEl?.value || "").toLowerCase();
    const cat       = _memberCatFilter;
    const otherText = (document.getElementById("otherFilterText")?.value || "").toLowerCase();

    const cards = document.querySelectorAll("#itemsList .item-card");
    let visible = 0;
    cards.forEach(card => {
        const cardType = (card.dataset.itemType || "").toLowerCase();
        const cardText = card.textContent.toLowerCase();
        const cardName = card.dataset.name || "";
        let catMatch   = true;
        if (cat !== "all") {
            if (cat === "Other") {
                const isOther = cardType === "other" || cardType === "";
                catMatch = isOther && (!otherText || cardText.includes(otherText));
            } else {
                catMatch = cardType === cat.toLowerCase();
            }
        }
        const textMatch = !q || cardText.includes(q) || cardName.includes(q);
        const show = catMatch && textMatch;
        card.style.display = show ? "" : "none";
        if (show) visible++;
    });
    const countEl = document.getElementById("itemsCountLabel");
    if (countEl) {
        countEl.textContent = q || cat !== "all"
            ? `${visible} item${visible !== 1 ? "s" : ""} shown`
            : `${cards.length} item${cards.length !== 1 ? "s" : ""} available`;
    }
}

/* ════════════════════════════════════════════════════════
   REQUEST FORM  (member — requestform.html)
   ════════════════════════════════════════════════════════ */
function selectType(type) {
    document.querySelectorAll(".type-choice").forEach(btn => btn.classList.remove("active-lost", "active-found"));
    const btn = type === "Lost" ? document.getElementById("typeLost") : document.getElementById("typeFound");
    if (btn) btn.classList.add(type === "Lost" ? "active-lost" : "active-found");
    const catEl = document.getElementById("category");
    if (catEl) catEl.value = type;
}

function initRequestForm() {
    const user = ensureLogin("member");
    if (!user) return;

    const params  = new URLSearchParams(window.location.search);
    const urlType = params.get("type");
    if (urlType === "Lost" || urlType === "Found") selectType(urlType);

    document.querySelectorAll(".type-choice").forEach(btn => btn.addEventListener("click", () => selectType(btn.dataset.type)));

    document.querySelectorAll(".type-tile").forEach(tile => {
        tile.addEventListener("click", () => {
            document.querySelectorAll(".type-tile").forEach(t => t.classList.remove("active"));
            tile.classList.add("active");
            const tileType = tile.dataset.type;
            if (document.getElementById("itemType")) document.getElementById("itemType").value = tileType;
            const otherWrap = document.getElementById("otherTypeWrap");
            if (tileType === "Other") { otherWrap?.classList.remove("hidden"); document.getElementById("otherTypeText")?.focus(); }
            else { otherWrap?.classList.add("hidden"); }
        });
    });

    const form      = document.getElementById("requestForm");
    const msgEl     = document.getElementById("requestSuccess");
    const cancelBtn = document.querySelector(".form-actions a.button.secondary");

    let isFormDirty = false;
    form.addEventListener("input", () => isFormDirty = true);
    window.addEventListener("beforeunload", e => { if (isFormDirty) { e.preventDefault(); e.returnValue = ""; } });

    if (cancelBtn) {
        cancelBtn.addEventListener("click", e => {
            if (isFormDirty) {
                e.preventDefault();
                showConfirm("Discard Form?", "You have unsaved details. Are you sure you want to go back?", "Discard", true, () => {
                    window.location.href = cancelBtn.href;
                });
            }
        });
    }

    form.addEventListener("submit", async e => {
        e.preventDefault();
        if (msgEl) { msgEl.textContent = ""; msgEl.className = ""; }

        const category = document.getElementById("category").value;
        if (!category) { showMsg(msgEl, "Please choose whether you lost or found the item.", "error"); return; }

        let itemType = document.getElementById("itemType").value;
        if (!itemType) { showMsg(msgEl, "Please select the item type.", "error"); return; }
        if (itemType === "Other") {
            const custom = document.getElementById("otherTypeText")?.value.trim();
            if (!custom) { showMsg(msgEl, "Please describe what type of item it is.", "error"); return; }
            itemType = custom;
        }

        const itemName    = document.getElementById("itemName").value.trim();
        const description = document.getElementById("description").value.trim();
        const location    = document.getElementById("location").value.trim();
        const dateFound   = document.getElementById("dateFound").value;
        const contactInfo = document.getElementById("contactInfo").value.trim();
        if (!itemName || !description || !location || !dateFound || !contactInfo) {
            showMsg(msgEl, "Please complete every field before submitting.", "error"); return;
        }

        showConfirm("Submit Request", `Are you sure you want to post this ${category} item?`, "Submit", false, async () => {
            const submitBtn = form.querySelector("button[type=submit]");
            if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Submitting…"; }
            try {
                await dbInsertRequest({
                    id: `req-${Date.now()}`,
                    name: itemName, category, itemType, description, location,
                    date: dateFound, contact: contactInfo,
                    requestedBy: user.email, status: "pending"
                });
                logActivity("post_request", `${user.email} submitted a ${category} request for "${itemName}" (${itemType})`);
                isFormDirty = false;
                form.reset();
                document.querySelectorAll(".type-tile").forEach(t  => t.classList.remove("active"));
                document.querySelectorAll(".type-choice").forEach(b => b.classList.remove("active-lost","active-found"));
                document.getElementById("itemType").value = "";
                document.getElementById("category").value = "";
                document.getElementById("otherTypeWrap")?.classList.add("hidden");
                showMsg(msgEl, "Request submitted! An admin will review it shortly.", "success");
            } catch (err) {
                showMsg(msgEl, "Could not submit request. Please try again.", "error");
                console.error(err);
            } finally {
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Submit Request"; }
            }
        });
    });
}

/* ════════════════════════════════════════════════════════
   ADMIN PAGE
   ════════════════════════════════════════════════════════ */
function initAdminPage() {
    const user = ensureLogin("admin");
    if (!user) return;
    document.getElementById("logoutBtn").onclick = logout;
    document.querySelectorAll(".nav-link[data-section]").forEach(link => {
        link.addEventListener("click", e => { e.preventDefault(); switchAdminSection(link.dataset.section); });
    });
    renderAdminDashboard();
}

function switchAdminSection(section) {
    document.querySelectorAll(".nav-link[data-section]").forEach(l =>
        l.classList.toggle("active", l.dataset.section === section)
    );
    document.querySelectorAll(".admin-section").forEach(s =>
        s.classList.toggle("hidden", s.id !== `section-${section}`)
    );
    const renders = {
        "dashboard":    renderAdminDashboard,
        "manage-items": renderManageItems,
        "claims":       renderClaimsSection,
        "users":        renderUsersSection,
        "activity":     renderActivityLog,
        "conversations": renderResolutions
    };
    renders[section]?.();
}

/* ── Dashboard ───────────────────────────────────────── */
async function renderAdminDashboard() {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set("statTotal","…"); set("statPendingClaims","…"); set("statFoundItems","…"); set("statMembers","…");
    const pendingEl  = document.getElementById("pendingRequests");
    const approvedEl = document.getElementById("approvedItems");
    if (pendingEl)  pendingEl.innerHTML  = loadingState("Loading requests…");
    if (approvedEl) approvedEl.innerHTML = loadingState("Loading items…");

    try {
        const [items, requests, claims, users, chatReqs] = await Promise.all([
            dbGetItems(), dbGetRequests(), dbGetClaims(), dbGetUsers(), dbGetChatRequests()
        ]);
        
        const pendingReq    = requests.filter(r => r.status === "pending");
        const pendingClaims = claims.filter(c => c.status === "pending");
        const pendingChats  = chatReqs.filter(cr => cr.status === "pending"); 
        const totalPending  = pendingReq.length + pendingClaims.length + pendingChats.length; 

        set("statTotal",         items.length);
        set("statPendingClaims", pendingClaims.length);
        set("statFoundItems",    items.filter(i => i.category === "Found").length);
        set("statMembers",       users.length);
        set("notificationCount", totalPending);

        const claimBadge = document.getElementById("claimsBadgeSidebar");
        if (claimBadge) { claimBadge.textContent = pendingClaims.length; claimBadge.classList.toggle("hidden", pendingClaims.length === 0); }

        if (pendingEl) {
            pendingEl.innerHTML = pendingReq.length
                ? pendingReq.map(req => renderRequestCard(req, `
                    <div class="request-actions">
                        <button class="button primary sm" data-action="approve-post" data-id="${req.id}"><i class="ph ph-check"></i> Approve</button>
                        <button class="button danger sm" data-action="reject-post" data-id="${req.id}"><i class="ph ph-x"></i> Reject</button>
                    </div>`)).join("")
                : emptyState("No pending requests right now.");
            pendingEl.querySelectorAll("button[data-action]").forEach(btn =>
                btn.addEventListener("click", () => processRequest(btn.dataset.id, btn.dataset.action, requests))
            );
        }
        if (approvedEl) {
            approvedEl.innerHTML = items.length
                ? items.map(i => renderItemCard(i)).join("")
                : emptyState("No approved items yet.");
        }

        const bell  = document.getElementById("notificationBell");
        const modal = document.getElementById("requestModal");
        if (bell && modal) {
            bell.onclick = () => openRequestModal(pendingReq, pendingClaims, pendingChats, modal, requests, claims);
            document.getElementById("closeModal").onclick = () => closeModal(modal);
            modal.querySelector(".modal-backdrop").onclick = () => closeModal(modal);
        }

        const searchEl = document.getElementById("adminSearch");
        if (searchEl) {
            searchEl.oninput = () => {
                const q = searchEl.value.toLowerCase();
                document.querySelectorAll("#section-dashboard .item-card").forEach(card => {
                    card.style.display = card.textContent.toLowerCase().includes(q) ? "" : "none";
                });
            };
        }
    } catch (err) {
        console.error("Dashboard load failed:", err);
        if (pendingEl)  pendingEl.innerHTML  = emptyState("Could not load data. Please refresh.");
        if (approvedEl) approvedEl.innerHTML = "";
    }
}

/* ── Manage Items ────────────────────────────────────── */
let _itemFilter  = "all";
let _isEditDirty = false;
let _cachedItems = [];

async function renderManageItems() {
    const countEl = document.getElementById("itemCountLabel");
    const listEl  = document.getElementById("allItemsList");
    if (listEl) listEl.innerHTML = loadingState("Loading items…");

    try {
        _cachedItems = await dbGetItems();
        setupManageItemsUI(_cachedItems, countEl, listEl);
    } catch (err) {
        console.error(err);
        if (listEl) listEl.innerHTML = emptyState("Could not load items.");
    }

    const editModal = document.getElementById("editModal");
    if (editModal) {
        const closeEditHandler = () => {
            if (_isEditDirty) {
                showConfirm("Discard Changes?", "You have unsaved edits. Are you sure you want to cancel?", "Discard", true, () => {
                    closeModal(editModal); _isEditDirty = false;
                });
            } else { closeModal(editModal); }
        };
        document.getElementById("closeEditModal").onclick  = closeEditHandler;
        document.getElementById("cancelEditModal").onclick = closeEditHandler;
        editModal.querySelector(".modal-backdrop").onclick = closeEditHandler;
        document.getElementById("editItemForm").onsubmit   = e => { e.preventDefault(); saveItemEdit(); };
    }
}

function setupManageItemsUI(items, countEl, listEl) {
    function applyFilter() {
        const search   = (document.getElementById("itemSearch")?.value || "").toLowerCase();
        const filtered = items.filter(i => {
            const matchFilter = _itemFilter === "all" || i.category === _itemFilter || i.status === _itemFilter;
            const matchSearch = !search || i.name.toLowerCase().includes(search) || i.description?.toLowerCase().includes(search);
            return matchFilter && matchSearch;
        });
        if (countEl) countEl.textContent = `Showing ${filtered.length} of ${items.length} item${items.length !== 1 ? "s" : ""}`;
        if (!listEl) return;
        listEl.innerHTML = filtered.length
            ? filtered.map(item => renderItemCard(item, `
                <div class="request-actions">
                    <button class="button secondary sm edit-btn" data-id="${item.id}"><i class="ph ph-pencil-simple"></i> Edit</button>
                    <button class="button danger sm delete-btn" data-id="${item.id}"><i class="ph ph-trash"></i> Delete</button>
                </div>`)).join("")
            : emptyState("No items match this filter.");
        listEl.querySelectorAll(".edit-btn").forEach(btn  => btn.addEventListener("click", () => openEditModal(btn.dataset.id)));
        listEl.querySelectorAll(".delete-btn").forEach(btn => btn.addEventListener("click", () => deleteItem(btn.dataset.id)));
    }
    document.querySelectorAll("#itemFilter .filter-tab").forEach(tab => {
        tab.addEventListener("click", () => {
            document.querySelectorAll("#itemFilter .filter-tab").forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            _itemFilter = tab.dataset.filter;
            applyFilter();
        });
    });
    const searchEl = document.getElementById("itemSearch");
    if (searchEl) searchEl.oninput = applyFilter;
    applyFilter();
}

function openEditModal(id) {
    _isEditDirty = false;
    const item = _cachedItems.find(i => i.id === id);
    if (!item) return;
    document.getElementById("editItemId").value       = item.id;
    document.getElementById("editItemName").value     = item.name;
    document.getElementById("editItemCategory").value = item.category;
    document.getElementById("editItemDesc").value     = item.description;
    document.getElementById("editItemLocation").value = item.location;
    document.getElementById("editItemStatus").value   = item.status;
    document.getElementById("editItemContact").value  = item.contact;
    document.getElementById("editItemForm").oninput   = () => _isEditDirty = true;
    const m = document.getElementById("editModal");
    m.classList.remove("hidden"); m.setAttribute("aria-hidden", "false");
}

async function saveItemEdit() {
    showConfirm("Save Changes", "Apply these updates to the item?", "Save", false, async () => {
        const id = document.getElementById("editItemId").value;
        const fields = {
            name:        document.getElementById("editItemName").value.trim(),
            category:    document.getElementById("editItemCategory").value,
            description: document.getElementById("editItemDesc").value.trim(),
            location:    document.getElementById("editItemLocation").value.trim(),
            status:      document.getElementById("editItemStatus").value,
            contact:     document.getElementById("editItemContact").value.trim(),
        };
        try {
            await dbUpdateItem(id, fields);
            const prev = _cachedItems.find(i => i.id === id);
            logActivity("item_edited", `"${prev?.name || id}" was edited`);
            _isEditDirty = false;
            closeModal(document.getElementById("editModal"));
            await renderManageItems();
        } catch (err) {
            console.error("Save failed:", err);
            showToast("Could not save changes. Please try again.");
        }
    });
}

async function deleteItem(id) {
    const item = _cachedItems.find(i => i.id === id);
    if (!item) return;
    showConfirm("Delete Item", `Permanently delete "${item.name}"? This cannot be undone.`, "Delete", true, async () => {
        try {
            await dbDeleteItem(id);
            logActivity("item_deleted", `"${item.name}" was deleted`);
            await renderManageItems();
        } catch (err) {
            console.error("Delete failed:", err);
            showToast("Could not delete item. Please try again.");
        }
    });
}

/* ── Claims section ──────────────────────────────────── */
let _claimsFilter = "all";

async function renderClaimsSection() {
    const countEl = document.getElementById("claimsCountLabel");
    const listEl  = document.getElementById("allClaimsList");
    if (listEl) listEl.innerHTML = loadingState("Loading claims…");

    try {
        const claims = await dbGetClaims();
        function applyFilter() {
            const filtered = _claimsFilter === "all" ? claims : claims.filter(c => c.status === _claimsFilter);
            if (countEl) countEl.textContent = `Showing ${filtered.length} claim${filtered.length !== 1 ? "s" : ""}`;
            if (!listEl) return;
            listEl.innerHTML = filtered.length
                ? filtered.map(c => {
                    const actions = c.status === "pending" ? `
                        <div class="request-actions">
                            <button class="button primary sm" data-action="approve-claim" data-id="${c.id}"><i class="ph ph-check"></i> Approve</button>
                            <button class="button danger sm" data-action="reject-claim" data-id="${c.id}"><i class="ph ph-x"></i> Reject</button>
                        </div>` : "";
                    return renderClaimCard(c, actions);
                }).join("")
                : emptyState("No claims in this category.");
            listEl.querySelectorAll("button[data-action]").forEach(btn => {
                btn.addEventListener("click", () => {
                    const action = btn.dataset.action === "approve-claim" ? "approve" : "reject";
                    processClaim(btn.dataset.id, action, claims, true);
                });
            });
        }
        document.querySelectorAll("#claimsFilter .filter-tab").forEach(tab => {
            tab.addEventListener("click", () => {
                document.querySelectorAll("#claimsFilter .filter-tab").forEach(t => t.classList.remove("active"));
                tab.classList.add("active");
                _claimsFilter = tab.dataset.filter;
                applyFilter();
            });
        });
        applyFilter();
    } catch (err) {
        console.error(err);
        if (listEl) listEl.innerHTML = emptyState("Could not load claims.");
    }
}

/* ── Users section ───────────────────────────────────── */
async function renderUsersSection() {
    const countEl  = document.getElementById("usersCountLabel");
    const listEl   = document.getElementById("usersList");
    const searchEl = document.getElementById("userSearch");
    if (listEl) listEl.innerHTML = loadingState("Loading members…");

    try {
        const [users, requests, claims] = await Promise.all([dbGetUsers(), dbGetRequests(), dbGetClaims()]);

        function applyFilter() {
            const q        = (searchEl?.value || "").toLowerCase();
            const filtered = q ? users.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) : users;
            if (countEl) countEl.textContent = `${filtered.length} member${filtered.length !== 1 ? "s" : ""} registered`;
            if (!listEl) return;
            if (!filtered.length) { listEl.innerHTML = emptyState("No members found."); return; }
            listEl.innerHTML = filtered.map(u => {
                const reqCount   = requests.filter(r => r.requestedBy === u.email).length;
                const claimCount = claims.filter(c => c.requestedBy === u.email).length;
                const joinDate   = u.joinedAt ? new Date(u.joinedAt).toLocaleDateString() : "Unknown";
                return `
                <article class="card item-card">
                    <div class="item-header">
                        <div style="display:flex;align-items:center;gap:11px;">
                            <div class="profile-avatar" style="width:42px;height:42px;font-size:0.9rem;">${esc(u.name.slice(0,2).toUpperCase())}</div>
                            <div>
                                <h3 style="margin-bottom:2px;">${esc(u.name)}</h3>
                                <p style="margin:0;font-size:0.79rem;color:var(--text-secondary);">${esc(u.email)}</p>
                            </div>
                        </div>
                        <span class="tag tag-approved">● Member</span>
                    </div>
                    <dl style="margin-top:12px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
                        <div class="user-stat"><dt>Joined</dt><dd style="font-size:0.9rem;">${joinDate}</dd></div>
                        <div class="user-stat"><dt>Requests</dt><dd>${reqCount}</dd></div>
                        <div class="user-stat"><dt>Claims</dt><dd>${claimCount}</dd></div>
                    </dl>
                    <div class="request-actions">
                        <button class="button danger sm remove-user-btn" data-email="${esc(u.email)}">Remove User</button>
                    </div>
                </article>`;
            }).join("");

            listEl.querySelectorAll(".remove-user-btn").forEach(btn =>
                btn.addEventListener("click", () => {
                    showConfirm("Remove Member", `Permanently remove user ${btn.dataset.email}?`, "Remove", true, async () => {
                        try {
                            await dbDeleteUser(btn.dataset.email);
                            await renderUsersSection();
                        } catch (err) {
                            console.error(err);
                            showToast("Could not remove user. Please try again.");
                        }
                    });
                })
            );
        }
        if (searchEl) searchEl.oninput = applyFilter;
        applyFilter();
    } catch (err) {
        console.error(err);
        if (listEl) listEl.innerHTML = emptyState("Could not load users.");
    }
}

/* ── Activity Log ────────────────────────────────────── */
function renderActivityLog() {
    const log     = (() => { try { return JSON.parse(localStorage.getItem(STORAGE_ACTIVITY)) ?? []; } catch { return []; } })();
    const countEl = document.getElementById("activityCountLabel");
    const listEl  = document.getElementById("activityList");
    if (countEl) countEl.textContent = `${log.length} event${log.length !== 1 ? "s" : ""} recorded`;
    if (!listEl) return;
    if (!log.length) { listEl.innerHTML = emptyState("No activity recorded yet."); return; }
    listEl.innerHTML = log.map(entry => {
        const icon  = ACTIVITY_ICONS[entry.type] || "◎";
        const time  = new Date(entry.timestamp).toLocaleString();
        const label = entry.type.replace(/_/g, " ");
        return `
        <div class="activity-entry">
            <div class="activity-icon">${icon}</div>
            <div>
                <p class="activity-detail">${esc(entry.detail)}</p>
                <p class="activity-meta"><span class="activity-type">${esc(label)}</span> · ${esc(time)}</p>
            </div>
        </div>`;
    }).join("");
    const clearBtn = document.getElementById("clearActivityBtn");
    if (clearBtn) {
        clearBtn.onclick = () => {
            showConfirm("Clear Log", "Are you sure you want to clear the entire activity log? This cannot be undone.", "Clear All", true, () => {
                localStorage.setItem(STORAGE_ACTIVITY, JSON.stringify([]));
                logActivity("activity_cleared", "Activity log cleared by admin");
                renderActivityLog();
            });
        };
    }
}

/* ── Modals ──────────────────────────────────────────── */
/* ── Modals ──────────────────────────────────────────── */
function openRequestModal(pendingReq, pendingClaims, pendingChats, modal, allRequests, allClaims) {
    modal.classList.remove("hidden"); modal.setAttribute("aria-hidden", "false");
    const postEl  = document.getElementById("modalPostRequests");
    const claimEl = document.getElementById("modalClaimRequests");
    const chatEl  = document.getElementById("modalChatRequests");

    if (postEl) postEl.innerHTML = pendingReq.length
        ? pendingReq.map(req => renderRequestCard(req, `
            <div class="request-actions">
                <button class="button primary sm" data-action="approve-post" data-id="${req.id}"><i class="ph ph-check"></i> Approve</button>
                <button class="button danger sm" data-action="reject-post" data-id="${req.id}"><i class="ph ph-x"></i> Reject</button>
            </div>`)).join("")
        : emptyState("No pending post requests.");

    if (claimEl) claimEl.innerHTML = pendingClaims.length
        ? pendingClaims.map(c => renderClaimCard(c, `
            <div class="request-actions">
                <button class="button primary sm" data-action="approve-claim" data-id="${c.id}"><i class="ph ph-check"></i> Approve</button>
                <button class="button danger sm" data-action="reject-claim" data-id="${c.id}"><i class="ph ph-x"></i> Reject</button>
            </div>`)).join("")
        : emptyState("No pending claim requests.");

    if (chatEl) chatEl.innerHTML = pendingChats.length
        ? pendingChats.map(chat => `
            <article class="card item-card">
                <div class="item-header"><span class="tag tag-pending"><i class="ph ph-chat-circle"></i> Chat Request</span></div>
                <h3 style="margin-top:8px;">${esc(chat.user_name)}</h3>
                <p><strong>Reason:</strong> ${esc(chat.reason)}</p>
                <p style="font-size: 0.8rem; color: var(--text-secondary);">${esc(chat.user_email)}</p>
                <div class="request-actions">
                    <button class="button primary sm" data-action="approve-chat" data-id="${chat.id}" data-email="${esc(chat.user_email)}" data-name="${esc(chat.user_name)}"><i class="ph ph-chat-text"></i> Accept & Chat</button>
                    <button class="button danger sm" data-action="reject-chat" data-id="${chat.id}"><i class="ph ph-x"></i> Reject</button>
                </div>
            </article>`).join("")
        : emptyState("No pending chat requests.");

    modal.querySelectorAll("button[data-action]").forEach(btn => {
        const { action, id, email, name } = btn.dataset;
        btn.onclick = () => {
            if (action === "approve-post")  processRequest(id, "approve", allRequests);
            if (action === "reject-post")   processRequest(id, "reject",  allRequests);
            if (action === "approve-claim") processClaim(id, "approve", allClaims);
            if (action === "reject-claim")  processClaim(id, "reject",  allClaims);
            if (action === "approve-chat")  processChatRequest(id, "approve", email, name);
            if (action === "reject-chat")   processChatRequest(id, "reject", email, name);
        };
    });
}

function closeModal(modal) { 
    // Remove focus from the clicked button to prevent aria-hidden browser warnings
    if (document.activeElement) {
        document.activeElement.blur();
    }
    
    modal.classList.add("hidden"); 
    modal.setAttribute("aria-hidden", "true"); 
}
async function processChatRequest(id, action, email, name) {
    const isApprove = action === "approve";
    const actionTxt = isApprove ? "Accept" : "Reject";

    showConfirm(`${actionTxt} Chat Request`, `Are you sure you want to ${actionTxt.toLowerCase()} this chat request?`, actionTxt, !isApprove, async () => {
        try {
            await dbUpdateChatRequestStatus(id, isApprove ? "approved" : "rejected");
            closeModal(document.getElementById("requestModal"));
            
            if (isApprove) {
                window.location.href = `messageft.html?email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}`;
            } else {
                await renderAdminDashboard();
            }
        } catch (err) {
            console.error(err);
            showToast("Error processing chat request.");
        }
    });
}

/* ── Admin Actions ───────────────────────────────────── */
async function processRequest(id, action, cachedRequests = null) {
    const isApprove = action === "approve";
    const actionTxt = isApprove ? "Approve" : "Reject";

    showConfirm(`${actionTxt} Request`, `Are you sure you want to ${actionTxt.toLowerCase()} this post request?`, actionTxt, !isApprove, async () => {
        try {
            const requests = cachedRequests || await dbGetRequests();
            const req = requests.find(r => r.id === id);
            if (!req) return;
            if (isApprove) {
                await dbInsertItem({
                    id: `item-${Date.now()}`,
                    name: req.name, category: req.category, itemType: req.itemType,
                    description: req.description, location: req.location,
                    date: req.date, contact: req.contact
                });
                logActivity("post_approved", `"${req.name}" by ${req.requestedBy} was approved`);
            } else {
                logActivity("post_rejected", `"${req.name}" by ${req.requestedBy} was rejected`);
            }
            await dbUpdateRequestStatus(id, isApprove ? "approved" : "rejected");
            closeModal(document.getElementById("requestModal"));
            await renderAdminDashboard();
        } catch (err) {
            console.error("processRequest failed:", err);
            showToast("Could not process request. Please try again.");
        }
    });
}

async function processClaim(id, action, cachedClaims = null, fromClaimsSection = false) {
    const isApprove = action === "approve";
    const actionTxt = isApprove ? "Approve" : "Reject";

    showConfirm(`${actionTxt} Claim`, `Are you sure you want to ${actionTxt.toLowerCase()} this claim request?`, actionTxt, !isApprove, async () => {
        try {
            const claims = cachedClaims || await dbGetClaims();
            const claim  = claims.find(c => c.id === id);
            if (!claim) return;
            await dbUpdateClaimStatus(id, isApprove ? "approved" : "rejected");
            if (isApprove) {
                await dbUpdateItem(claim.itemId, { status: "Claimed" });
                logActivity("claim_approved", `Claim on "${claim.name}" by ${claim.requestedBy} approved`);
            } else {
                logActivity("claim_rejected", `Claim on "${claim.name}" by ${claim.requestedBy} rejected`);
            }
            if (fromClaimsSection) await renderClaimsSection();
            else { closeModal(document.getElementById("requestModal")); await renderAdminDashboard(); }
        } catch (err) {
            console.error("processClaim failed:", err);
            showToast("Could not process claim. Please try again.");
        }
    });
}

/* ════════════════════════════════════════════════════════
   ADMIN REQUEST FORM  (adminrequestform.html)
   ════════════════════════════════════════════════════════ */
function initAdminRequestForm() {
    const user = ensureLogin("admin");
    if (!user) return;

    const params  = new URLSearchParams(window.location.search);
    const urlType = params.get("type");
    if (urlType === "Lost" || urlType === "Found") selectType(urlType);

    document.querySelectorAll(".type-choice").forEach(btn => btn.addEventListener("click", () => selectType(btn.dataset.type)));

    document.querySelectorAll(".type-tile").forEach(tile => {
        tile.addEventListener("click", () => {
            document.querySelectorAll(".type-tile").forEach(t => t.classList.remove("active"));
            tile.classList.add("active");
            const tileType = tile.dataset.type;
            if (document.getElementById("itemType")) document.getElementById("itemType").value = tileType;
            const otherWrap = document.getElementById("otherTypeWrap");
            if (tileType === "Other") { otherWrap?.classList.remove("hidden"); document.getElementById("otherTypeText")?.focus(); }
            else { otherWrap?.classList.add("hidden"); }
        });
    });

    const form      = document.getElementById("requestForm");
    const msgEl     = document.getElementById("requestSuccess");
    const cancelBtn = document.querySelector(".form-actions a.button.secondary");

    let isFormDirty = false;
    form.addEventListener("input", () => isFormDirty = true);
    window.addEventListener("beforeunload", e => { if (isFormDirty) { e.preventDefault(); e.returnValue = ""; } });

    if (cancelBtn) {
        cancelBtn.addEventListener("click", e => {
            if (isFormDirty) {
                e.preventDefault();
                showConfirm("Discard Post?", "You have unsaved details. Are you sure you want to go back?", "Discard", true, () => {
                    window.location.href = cancelBtn.href;
                });
            }
        });
    }

    form.addEventListener("submit", async e => {
        e.preventDefault();
        if (msgEl) { msgEl.textContent = ""; msgEl.className = ""; }

        const category = document.getElementById("category").value;
        if (!category) { showMsg(msgEl, "Please choose Lost or Found.", "error"); return; }

        let itemType = document.getElementById("itemType").value;
        if (!itemType) { showMsg(msgEl, "Please select the item type.", "error"); return; }
        if (itemType === "Other") {
            const custom = document.getElementById("otherTypeText")?.value.trim();
            if (!custom) { showMsg(msgEl, "Please describe the item type.", "error"); return; }
            itemType = custom;
        }

        const itemName    = document.getElementById("itemName").value.trim();
        const description = document.getElementById("description").value.trim();
        const location    = document.getElementById("location").value.trim();
        const dateFound   = document.getElementById("dateFound").value;
        const contactInfo = document.getElementById("contactInfo").value.trim();
        if (!itemName || !description || !location || !dateFound || !contactInfo) {
            showMsg(msgEl, "Please complete every field before posting.", "error"); return;
        }

        showConfirm(
            "Post Item Directly",
            `Post "${itemName}" as a ${category} item? It will be live on the board immediately.`,
            "Post Item", false,
            async () => {
                const submitBtn = form.querySelector("button[type=submit]");
                if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Posting…"; }
                try {
                    await dbInsertItem({
                        id: `item-${Date.now()}`,
                        name: itemName, category, itemType, description, location,
                        date: dateFound, contact: contactInfo
                    });
                    logActivity("post_approved", `Admin posted "${itemName}" (${category} · ${itemType}) directly`);
                    isFormDirty = false;
                    window.location.href = "adminpage.html";
                } catch (err) {
                    showMsg(msgEl, "Could not post item. Please try again.", "error");
                    console.error(err);
                    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Post Item"; }
                }
            }
        );
    });
}

/* ════════════════════════════════════════════════════════
   MOBILE MENU
   ════════════════════════════════════════════════════════ */
function initMobileMenu() {
    const mobileMenuBtn = document.getElementById("mobileMenuBtn");
    const appSidebar    = document.getElementById("appSidebar");
    const menuIcon      = document.getElementById("menuIcon");
    if (!mobileMenuBtn || !appSidebar) return;
    mobileMenuBtn.addEventListener("click", () => {
        appSidebar.classList.toggle("open");
        if (menuIcon) menuIcon.className = appSidebar.classList.contains("open") ? "ph ph-x" : "ph ph-list";
    });
    document.querySelectorAll(".nav-link").forEach(link => {
        link.addEventListener("click", () => {
            appSidebar.classList.remove("open");
            if (menuIcon) menuIcon.className = "ph ph-list";
        });
    });
    document.addEventListener("click", e => {
        if (appSidebar.classList.contains("open") &&
            !appSidebar.contains(e.target) &&
            !mobileMenuBtn.contains(e.target)) {
            appSidebar.classList.remove("open");
            if (menuIcon) menuIcon.className = "ph ph-list";
        }
    });
}

/* ════════════════════════════════════════════════════════
   ROUTER
   ════════════════════════════════════════════════════════ */
function initPage() {
    const page = document.body.dataset.page;
    if (page === "login")        initLogin();
    if (page === "member")       initMemberPage();
    if (page === "admin")        initAdminPage();
    if (page === "request")      initRequestForm();
    if (page === "adminrequest") initAdminRequestForm();
    initMobileMenu();
}
window.addEventListener("DOMContentLoaded", initPage);

/* ════════════════════════════════════════════════════════
   NEW CHAT & RESOLUTION LOGIC
   ════════════════════════════════════════════════════════ */

// 1. Open Member Chat Request Modal
function openChatRequestModal() {
    const m = document.getElementById('chatRequestModal');
    if(m) { m.classList.remove('hidden'); m.setAttribute('aria-hidden', 'false'); }
}

// 2. Member Submits Chat Request
const chatReqForm = document.getElementById('chatRequestForm');
if(chatReqForm) {
    chatReqForm.onsubmit = async (e) => {
        e.preventDefault();
        const user = getCurrentUser();
        const reason = document.getElementById('chatReason').value;
        await supabaseClient.from('chat_requests').insert([{
            user_email: user.email, user_name: user.name, reason: reason
        }]);
        showToast("Chat request sent to admin!");
        closeModal(document.getElementById('chatRequestModal'));
    };
}

// 3. Admin: Load Users into the Select Modal
async function populateAdminChatUserList() {
    const list = document.getElementById('userChatList');
    if(!list) return;
    const { data: users } = await supabaseClient.from('users').select('*').neq('role', 'admin');
    
    list.innerHTML = users.map(u => `
        <div class="card item-card" style="display:flex; justify-content:space-between; align-items:center; padding:10px;">
            <div><p style="font-weight:bold; margin:0;">${esc(u.name)}</p><p style="font-size:0.8rem; margin:0;">${esc(u.email)}</p></div>
            <a href="messageft.html?email=${encodeURIComponent(u.email)}&name=${encodeURIComponent(u.name)}" class="button primary sm">Chat</a>
        </div>
    `).join("");
}

// Open User Select Modal and populate it
const userSelectModal = document.getElementById('userSelectModal');
if(userSelectModal) {
    // We attach an observer to load users when it is un-hidden
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (!userSelectModal.classList.contains('hidden')) populateAdminChatUserList();
        });
    });
    observer.observe(userSelectModal, { attributes: true, attributeFilter: ['class'] });
}

async function renderResolutions() {
    const listEl = document.getElementById("resolutionsList");
    if (!listEl) return;
    listEl.innerHTML = loadingState("Loading meetings...");
    
    const user = getCurrentUser();
    let query = supabaseClient.from("resolutions").select("*").order("created_at", { ascending: false });
    
    // If a member is looking, only show their own meetings!
    if (user && user.role !== "admin") {
        query = query.eq("user_email", user.email);
    }
    
    const { data, error } = await query;
    if (error) { listEl.innerHTML = emptyState("Error loading logs."); return; }
    
    listEl.innerHTML = data.length ? data.map(r => `
        <article class="card item-card">
            <div class="item-header">
                <span class="tag tag-approved"><i class="ph ph-handshake"></i> ${esc(r.action_type)}</span>
                <span style="font-size: 0.8rem; color: var(--text-secondary);">${esc(r.meeting_date)} at ${esc(r.meeting_time)}</span>
            </div>
            <h3>Meeting with: ${esc(r.user_email)}</h3>
            <p><strong>Location:</strong> ${esc(r.location)}</p>
        </article>
    `).join("") : emptyState("No meeting resolutions logged yet.");
}