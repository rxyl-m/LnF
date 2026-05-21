// supabase/functions/send-email/index.ts
// ============================================================
// Supabase Edge Function — Email Notifications via Resend
//
// Deploy with:
//   supabase functions deploy send-email
//
// Set your Resend API key in Supabase:
//   supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxx
//
// Also set in Supabase dashboard → Project Settings → Edge Functions:
//   RESEND_API_KEY = re_xxxxxxxxxxxx
//   FROM_EMAIL     = noreply@yourdomain.com   (must be verified in Resend)
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL     = Deno.env.get("FROM_EMAIL") || "noreply@iacademy-lnf.com";
const FROM_NAME      = "iAcademy Lost & Found";

// ── Email Templates ──────────────────────────────────────────
function buildEmail(template: string, data: Record<string, string>) {
    const base = (content: string, title: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin:0; padding:0; background:#0d0f1a; font-family: 'Segoe UI', Arial, sans-serif; color:#e2e8f0; }
    .wrapper { max-width:560px; margin:40px auto; background:#13162a; border-radius:16px; overflow:hidden; border:1px solid rgba(77,130,255,0.2); }
    .header { background:linear-gradient(135deg,#1a2a6e,#0e1942); padding:32px 36px; text-align:center; }
    .logo-hex { display:inline-block; width:64px; height:64px; background:rgba(77,130,255,0.15); border:2px solid rgba(77,130,255,0.4); border-radius:12px; line-height:64px; font-size:28px; margin-bottom:16px; }
    .header h1 { margin:0; font-size:1.3rem; color:#fff; font-weight:700; letter-spacing:-0.3px; }
    .header p { margin:6px 0 0; font-size:0.82rem; color:rgba(255,255,255,0.55); }
    .body { padding:32px 36px; }
    .badge { display:inline-block; padding:5px 14px; border-radius:999px; font-size:0.75rem; font-weight:700; letter-spacing:0.5px; text-transform:uppercase; margin-bottom:18px; }
    .badge-success { background:rgba(16,185,129,0.15); color:#10b981; border:1px solid rgba(16,185,129,0.3); }
    .badge-error   { background:rgba(225,29,72,0.15); color:#e11d48; border:1px solid rgba(225,29,72,0.3); }
    .badge-info    { background:rgba(77,130,255,0.15); color:#4d82ff; border:1px solid rgba(77,130,255,0.3); }
    .badge-warning { background:rgba(245,158,11,0.15); color:#f59e0b; border:1px solid rgba(245,158,11,0.3); }
    h2 { margin:0 0 10px; font-size:1.25rem; color:#fff; font-weight:700; }
    p  { margin:0 0 14px; font-size:0.9rem; color:#94a3b8; line-height:1.6; }
    .detail-box { background:#0d0f1a; border:1px solid rgba(77,130,255,0.15); border-radius:10px; padding:16px 20px; margin:20px 0; }
    .detail-box dt { font-size:0.72rem; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:2px; }
    .detail-box dd { font-size:0.9rem; color:#e2e8f0; font-weight:600; margin:0 0 12px; }
    .detail-box dd:last-child { margin-bottom:0; }
    .cta { display:block; text-align:center; margin:24px 0 0; padding:13px 28px; background:#4d82ff; color:#fff!important; border-radius:10px; font-size:0.9rem; font-weight:700; text-decoration:none; letter-spacing:0.2px; }
    .footer { padding:20px 36px; border-top:1px solid rgba(255,255,255,0.07); text-align:center; font-size:0.72rem; color:#475569; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="logo-hex">🔍</div>
      <h1>iAcademy Lost &amp; Found</h1>
      <p>Campus Item Recovery System</p>
    </div>
    <div class="body">${content}</div>
    <div class="footer">
      © 2026 iAcademy · Computing · Business · Design<br>
      This is an automated notification. Do not reply to this email.
    </div>
  </div>
</body>
</html>`;

    switch (template) {

        // ── 1. Post Approved ──────────────────────────────────
        case "post_approved":
            return {
                subject: `✅ Your item post has been approved — ${data.itemName}`,
                html: base(`
                    <span class="badge badge-success">Post Approved</span>
                    <h2>Your item is now live!</h2>
                    <p>Great news — an iAcademy admin has reviewed and approved your ${data.category} item post. It's now visible to all members on the board.</p>
                    <div class="detail-box">
                        <dl>
                            <dt>Item Name</dt><dd>${data.itemName}</dd>
                            <dt>Category</dt><dd>${data.category}</dd>
                            <dt>Location</dt><dd>${data.location}</dd>
                            <dt>Date Reported</dt><dd>${data.date}</dd>
                        </dl>
                    </div>
                    <p>Members can now view and reach out about this item. You'll be notified if someone claims it.</p>
                    <a href="https://your-site-url.com/memberpage.html" class="cta">View Your Post →</a>
                `, `Post Approved — ${data.itemName}`)
            };

        // ── 2. Post Rejected ──────────────────────────────────
        case "post_rejected":
            return {
                subject: `❌ Your item post request was not approved — ${data.itemName}`,
                html: base(`
                    <span class="badge badge-error">Post Not Approved</span>
                    <h2>Your post request was reviewed</h2>
                    <p>Unfortunately, an admin was unable to approve your post for <strong style="color:#e2e8f0;">${data.itemName}</strong> at this time.</p>
                    <p>This may be due to incomplete information or a duplicate entry. You're welcome to submit a new request with more detail.</p>
                    <a href="https://your-site-url.com/requestform.html" class="cta">Submit a New Request →</a>
                `, `Post Not Approved — ${data.itemName}`)
            };

        // ── 3. Claim Approved (claimant notified) ─────────────
        case "claim_approved":
            return {
                subject: `🎉 Your claim was approved — ${data.itemName}`,
                html: base(`
                    <span class="badge badge-success">Claim Approved</span>
                    <h2>Your claim has been approved!</h2>
                    <p>An admin has reviewed and approved your claim for <strong style="color:#e2e8f0;">${data.itemName}</strong>. The next step is coordinating the item handover.</p>
                    <p>Please check your dashboard for meeting details, or wait for the admin to reach out via the chat system.</p>
                    <a href="https://your-site-url.com/memberpage.html" class="cta">Open My Dashboard →</a>
                `, `Claim Approved — ${data.itemName}`)
            };

        // ── 4. Item Claimed (original poster notified) ────────
        case "item_claimed":
            return {
                subject: `📬 Someone has claimed your item — ${data.itemName}`,
                html: base(`
                    <span class="badge badge-info">Item Claimed</span>
                    <h2>Someone claimed your item</h2>
                    <p>A verified member has submitted a claim for your item: <strong style="color:#e2e8f0;">${data.itemName}</strong>.</p>
                    <div class="detail-box">
                        <dl>
                            <dt>Claimed By</dt><dd>${data.claimedBy}</dd>
                            <dt>Item</dt><dd>${data.itemName}</dd>
                        </dl>
                    </div>
                    <p>An admin is reviewing the claim. You may be contacted soon to arrange the handover.</p>
                    <a href="https://your-site-url.com/memberpage.html" class="cta">View My Items →</a>
                `, `Item Claimed — ${data.itemName}`)
            };

        // ── 5. Resolution / Meetup Confirmed ──────────────────
        case "resolution_confirmed":
            return {
                subject: `🤝 Meetup Confirmed — ${data.actionType}`,
                html: base(`
                    <span class="badge badge-warning">Meeting Scheduled</span>
                    <h2>Your meetup has been confirmed</h2>
                    <p>An iAcademy admin has logged a resolution meeting for your case. Here are the details:</p>
                    <div class="detail-box">
                        <dl>
                            <dt>Action</dt><dd>${data.actionType}</dd>
                            <dt>Date</dt><dd>${data.meetingDate}</dd>
                            <dt>Time</dt><dd>${data.meetingTime}</dd>
                            <dt>Location</dt><dd>${data.meetingLocation}</dd>
                        </dl>
                    </div>
                    <p>Please be on time and bring your school ID. If you have questions, contact the admin through the chat system.</p>
                    <a href="https://your-site-url.com/messageft.html" class="cta">Open Chat →</a>
                `, `Meetup Confirmed — ${data.actionType}`)
            };

        default:
            return null;
    }
}

// ── Handler ───────────────────────────────────────────────────
serve(async (req) => {
    // Allow CORS for browser fetches
    if (req.method === "OPTIONS") {
        return new Response(null, {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "authorization, content-type",
            },
        });
    }

    try {
        const { to, template, data } = await req.json();

        if (!to || !template) {
            return new Response(JSON.stringify({ error: "Missing 'to' or 'template'" }), { status: 400 });
        }

        const email = buildEmail(template, data || {});
        if (!email) {
            return new Response(JSON.stringify({ error: `Unknown template: ${template}` }), { status: 400 });
        }

        const resendRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${RESEND_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from: `${FROM_NAME} <${FROM_EMAIL}>`,
                to: [to],
                subject: email.subject,
                html: email.html,
            }),
        });

        const result = await resendRes.json();

        if (!resendRes.ok) {
            console.error("Resend error:", result);
            return new Response(JSON.stringify({ error: result }), { status: 500 });
        }

        return new Response(JSON.stringify({ success: true, id: result.id }), {
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
        });

    } catch (err) {
        console.error("Edge Function error:", err);
        return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
    }
});
