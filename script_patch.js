/* ============================================================
   script.js PATCH — ID Verification Upload + Email Notifications
   
   Instructions: Apply these changes to your existing script.js.
   Each section shows the EXACT function to find and what to add/replace.
   ============================================================ */


/* ────────────────────────────────────────────────────────────
   PATCH 1 of 4 — NEW HELPER: sendEmail()
   
   ADD this function anywhere near the top of script.js,
   after the STORAGE constants (around line 14).
   ────────────────────────────────────────────────────────────
   This calls your Supabase Edge Function "send-email".
   ──────────────────────────────────────────────────────────── */

async function sendEmail(to, template, data) {
    try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({ to, template, data })
        });
        if (!res.ok) {
            const err = await res.text();
            console.error('Email send failed:', err);
        }
    } catch (err) {
        console.error('sendEmail error:', err);
    }
}


/* ────────────────────────────────────────────────────────────
   PATCH 2 of 4 — ID Upload inside initRequestForm()
   
   FIND this block inside initRequestForm() (around line 1113):
   
        await dbInsertRequest({
            id: `req-${Date.now()}`,
            name: itemName, category, itemType, description, location,
            date: dateFound, contact: contactInfo,
            requestedBy: user.email, status: "pending",
            image_url: imageUrl
        });
   
   REPLACE WITH the block below (adds ID upload before dbInsertRequest):
   ──────────────────────────────────────────────────────────── */

// --- REPLACEMENT for the submit handler try-block inside initRequestForm() ---
// (Replaces from "let imageUrl = null;" to the end of the try block)

/*
try {
    let imageUrl = null;
    if (file) {
        const fileExt  = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${user.email}/${fileName}`;
        const { error: uploadError } = await supabaseClient.storage.from('item-images').upload(filePath, file);
        if (uploadError) throw uploadError;
        const { data: publicUrlData } = supabaseClient.storage.from('item-images').getPublicUrl(filePath);
        imageUrl = publicUrlData.publicUrl;
    }

    // ── NEW: Upload verification ID ──
    let verificationIdUrl = null;
    const idFile = document.getElementById('verificationId')?.files[0];
    if (idFile) {
        const idExt  = idFile.name.split('.').pop();
        const idName = `id-${Date.now()}-${Math.random().toString(36).substring(2)}.${idExt}`;
        const idPath = `verifications/${user.email}/${idName}`;
        const { error: idUploadError } = await supabaseClient.storage
            .from('item-images')
            .upload(idPath, idFile, { upsert: false });
        if (idUploadError) throw idUploadError;
        const { data: idUrlData } = supabaseClient.storage.from('item-images').getPublicUrl(idPath);
        verificationIdUrl = idUrlData.publicUrl;
    }

    await dbInsertRequest({
        id: `req-${Date.now()}`,
        name: itemName, category, itemType, description, location,
        date: dateFound, contact: contactInfo,
        requestedBy: user.email, status: "pending",
        image_url: imageUrl,
        verification_id_url: verificationIdUrl   // ← NEW field
    });
    logActivity("post_request", `${user.email} submitted a ${category} request for "${itemName}"`);
    showMsg(msgEl, "Request submitted! An admin will review it shortly.", "success");
    isFormDirty = false;
    form.reset();
    document.querySelectorAll(".type-tile").forEach(t  => t.classList.remove("active"));
    document.querySelectorAll(".type-choice").forEach(b => b.classList.remove("active-lost","active-found"));
    // Reset ID preview
    document.getElementById('idPreviewWrap')?.classList.add('hidden');
} catch (err) { ... }
*/


/* ────────────────────────────────────────────────────────────
   PATCH 3 of 4 — Email trigger in processRequest()
   
   FIND inside processRequest() (around line 1648):
   
        logActivity("post_approved", `"${req.name}" by ${req.requestedBy} was approved`);
        addNotification(`Post request for "${req.name}" approved.`, 'info');
   
   ADD these lines RIGHT AFTER the addNotification line:
   ──────────────────────────────────────────────────────────── */

// After approve:
await sendEmail(req.requestedBy, 'post_approved', {
    userName: req.requestedBy,
    itemName: req.name,
    category: req.category,
    location: req.location,
    date: req.date
});

// After reject (find the logActivity("post_rejected"...) line and add below it):
await sendEmail(req.requestedBy, 'post_rejected', {
    userName: req.requestedBy,
    itemName: req.name
});


/* ────────────────────────────────────────────────────────────
   PATCH 4 of 4 — Email trigger in processClaim() + resolutionForm
   
   A) FIND inside processClaim() (around line 1676):
   
        logActivity("claim_approved", `Claim on "${claim.name}" by ${claim.requestedBy} approved`);
        addNotification(`Claim on "${claim.name}" has been approved.`, 'info');
   
   ADD these lines RIGHT AFTER:
   ──────────────────────────────────────────────────────────── */

// Notify the *original poster* that someone's claim was approved on their item
const { data: originalItem } = await supabaseClient
    .from('items')
    .select('contact, name')
    .eq('id', claim.itemId)
    .single();

// Email the claimant that their claim was approved
await sendEmail(claim.requestedBy, 'claim_approved', {
    userName: claim.requestedBy,
    itemName: claim.name
});

// Email the original poster if their contact looks like an email
if (originalItem?.contact && originalItem.contact.includes('@')) {
    await sendEmail(originalItem.contact, 'item_claimed', {
        itemName: originalItem.name,
        claimedBy: claim.requestedBy
    });
}


/* ────────────────────────────────────────────────────────────
   B) FIND the resolutionForm onsubmit inside messageft.html:
   
        await supabaseClient.from('resolutions').insert([res]);
        await dbDeleteMessages(user.email, targetEmail);
   
   ADD this line RIGHT AFTER the .insert() line:
   ──────────────────────────────────────────────────────────── */

await sendEmail(targetEmail, 'resolution_confirmed', {
    userName: targetName,
    actionType: document.getElementById('resAction').value,
    meetingDate: document.getElementById('resDate').value,
    meetingTime: document.getElementById('resTime').value,
    meetingLocation: document.getElementById('resLocation').value
});


/* ────────────────────────────────────────────────────────────
   PATCH 5 of 5 — dbInsertRequest: add verification_id_url column
   
   FIND dbInsertRequest (around line 320):
   
        async function dbInsertRequest(req) {
            const { error } = await supabaseClient.from("requests").insert([{
                id: req.id, name: req.name, category: req.category, item_type: req.itemType,
                description: req.description, location: req.location, date: req.date,
                contact: req.contact, requested_by: req.requestedBy, status: "pending",
                image_url: req.image_url
            }]);
            if (error) throw error;
        }
   
   REPLACE WITH:
   ──────────────────────────────────────────────────────────── */

async function dbInsertRequest(req) {
    const { error } = await supabaseClient.from("requests").insert([{
        id: req.id, name: req.name, category: req.category, item_type: req.itemType,
        description: req.description, location: req.location, date: req.date,
        contact: req.contact, requested_by: req.requestedBy, status: "pending",
        image_url: req.image_url,
        verification_id_url: req.verification_id_url || null   // ← NEW
    }]);
    if (error) throw error;
}


/* ────────────────────────────────────────────────────────────
   PATCH: renderRequestCard — show ID verification link for admins
   
   FIND inside renderRequestCard() (around line 579), after the <dl> block:
   
        ${actionsHtml}
   
   REPLACE WITH (inside the function's template literal):
   ──────────────────────────────────────────────────────────── */

/* 
    Add this line inside renderRequestCard's return template,
    right before ${actionsHtml}:
    
    ${request.verificationIdUrl ? `
        <div style="margin-top:10px;padding:8px 12px;background:var(--bg-raised);border-radius:var(--radius-sm);border:1px solid var(--border);display:flex;align-items:center;gap:8px;">
            <i class="ph ph-shield-check" style="color:var(--accent);font-size:1rem;"></i>
            <span style="font-size:0.8rem;color:var(--text-secondary);">ID Verified &nbsp;</span>
            <a href="${esc(request.verificationIdUrl)}" target="_blank" rel="noopener"
               style="font-size:0.8rem;color:var(--accent);font-weight:600;">View ID ↗</a>
        </div>` : `
        <div style="margin-top:10px;padding:8px 12px;background:var(--bg-raised);border-radius:var(--radius-sm);border:1px solid var(--border);display:flex;align-items:center;gap:8px;">
            <i class="ph ph-warning" style="color:var(--yellow,#f59e0b);font-size:1rem;"></i>
            <span style="font-size:0.8rem;color:var(--text-muted);">No ID uploaded</span>
        </div>`}
    ${actionsHtml}

    AND update toRequest normalizer (around line 272) to include verification_id_url:
    const toRequest = r => ({ ..., verificationIdUrl: r.verification_id_url });
*/
