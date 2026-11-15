/**
 * HOMIE email relay (Google Apps Script).
 *
 * Sends HOMIE sign-in codes from your Gmail over HTTPS, because Vercel
 * functions cannot reach Gmail's SMTP servers.
 *
 * Setup (about 3 minutes):
 * 1. Go to https://script.google.com, click "New project", delete the sample
 *    code and paste this whole file. Name the project "HOMIE email relay".
 * 2. Project Settings (gear icon) > Script Properties > Add script property:
 *      Property: RELAY_SECRET   Value: a long random string (keep it private)
 * 3. Click Deploy > New deployment > type "Web app":
 *      Execute as: Me      Who has access: Anyone
 *    Click Deploy, approve the Gmail permission, and copy the Web app URL.
 * 4. In Vercel (homie > Settings > Environment Variables) add:
 *      EMAIL_RELAY_URL     = the Web app URL (ends in /exec)
 *      EMAIL_RELAY_SECRET  = the same RELAY_SECRET value
 *    then redeploy.
 *
 * Only @usc.edu recipients are accepted, and every request must carry the
 * secret, so the URL cannot be used to send mail anywhere else.
 */
function doPost(e) {
  var out = function (obj) {
    return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)
  }
  try {
    var secret = PropertiesService.getScriptProperties().getProperty('RELAY_SECRET')
    var req = JSON.parse(e.postData.contents)
    if (!secret || req.secret !== secret) return out({ ok: false, error: 'unauthorized' })
    if (!/^[^@\s]+@usc\.edu$/i.test(String(req.to || ''))) return out({ ok: false, error: 'recipient_not_allowed' })
    if (!req.subject || !req.text) return out({ ok: false, error: 'missing_fields' })

    MailApp.sendEmail({
      to: req.to,
      subject: String(req.subject).slice(0, 200),
      body: String(req.text),
      htmlBody: req.html ? String(req.html) : undefined,
      name: req.name || 'HOMIE',
    })
    return out({ ok: true, remaining_today: MailApp.getRemainingDailyQuota() })
  } catch (err) {
    return out({ ok: false, error: String(err).slice(0, 200) })
  }
}
