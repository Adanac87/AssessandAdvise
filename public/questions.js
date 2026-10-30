// Shared question schema: loaded by the browser (window.AA) and by the server (require).
(function (root) {
  const TENURE = ["Less than 1 year", "1–3 years", "3–5 years", "5–10 years", "10+ years"];
  const HOURS = ["Under 1", "1–2", "2–5", "5–10", "More than 10"];
  const HOURS_MID = { "Under 1": 0.5, "1–2": 1.5, "2–5": 3.5, "5–10": 7.5, "More than 10": 12 };

  const SECTIONS = [
    { id: "welcome", title: "Welcome", welcome: true },
    { id: "about", title: "About you", icon: "person", intro: "A little context so we can read your answers in the right light.", fields: [
      { id: "name", type: "text", label: "Your name", help: "Optional. Your name is never shown to leadership under a confidential engagement." },
      { pair: [
        { id: "title", type: "text", label: "Job title", required: true },
        { id: "dept", type: "select", label: "Studio or team", options: ["Architecture", "Interior design", "Technical / BIM", "Project management", "Leadership / principals", "Operations / admin", "IT", "Other"] }
      ] },
      { id: "phase", type: "checks", label: "Which project phases do you mostly work in?", options: ["Concept / schematic design", "Design development", "Construction documents", "Construction administration", "Interiors", "Marketing / proposals", "All phases"] },
      { pair: [
        { id: "tenureRole", type: "select", label: "Time in this role", options: TENURE },
        { id: "tenureCo", type: "select", label: "Time with the firm", options: TENURE }
      ] },
      { id: "directReports", type: "number", label: "How many people report to you?", help: "Enter 0 if none." },
      { id: "location", type: "radio", label: "Where do you mostly work?", options: ["Studio", "Remote", "Hybrid", "On site"] }
    ] },
    { id: "role", title: "Your role", icon: "briefcase", intro: "What you're responsible for, and how work reaches you and leaves you.", fields: [
      { id: "responsibilities", type: "textarea", label: "In a few sentences, what are you responsible for?" },
      { id: "deliverables", type: "textarea", label: "What do you produce?", help: "For example models, sheet sets, details, specifications, renderings, schedules, proposals, fee or resource plans." },
      { id: "inputsFrom", type: "textarea", label: "Who hands work to you, and in what form?" },
      { id: "outputsTo", type: "textarea", label: "Who do you hand work to, and how?" },
      { id: "split", type: "split", label: "Roughly how does a typical week split?", help: "Percentages. Close enough is fine.", parts: [["core", "Design / production"], ["meetings", "Meetings"], ["searching", "Finding information"], ["rework", "Rework / fixes"], ["admin", "Admin"]] }
    ] },
    { id: "workflow", title: "A recent project", icon: "route", intro: "Pick one recent, typical project and walk us through your part of it, from when it reached you to when it left you. Real examples tell us far more than general descriptions.", fields: [
      { id: "projectName", type: "text", label: "Which project are you thinking of?", help: "A short description is fine, e.g. “Mixed-use rental, CD set” or “Campus building, schematic design”." },
      { id: "steps", type: "steps", label: "The steps, in order", help: "One row per step. Note the software you used and anything that slowed you down." },
      { id: "changes", type: "textarea", label: "What happens when a design change comes in partway through?" },
      { id: "latestVersion", type: "textarea", label: "How do you know you're working from the latest model, drawing or consultant file?" }
    ] },
    { id: "software", title: "Software and tools", icon: "layers", intro: "Everything you use regularly, including Excel, Bluebeam, email and anything homegrown.", fields: [
      { id: "designTools", type: "checks", label: "Which of these do you use?", options: ["Revit", "AutoCAD", "Rhino", "Grasshopper", "SketchUp", "Enscape", "Twinmotion", "Lumion", "Bluebeam", "Adobe Creative Cloud", "Dynamo", "Navisworks", "Autodesk Docs / ACC", "Microsoft Teams / SharePoint", "Excel", "Other"] },
      { id: "apps", type: "apps", label: "Rate the tools you rely on most", help: "Add your top three to six." },
      { id: "fileSharing", type: "checks", label: "How do you share files with consultants and collaborators?", options: ["Autodesk Docs / ACC / BIM 360", "SharePoint / OneDrive / Teams", "Network drive", "FTP or file-transfer site", "Email attachments", "Newforma or similar", "Other"] },
      { id: "outsideTools", type: "textarea", label: "Where do you step outside your main tools to get the job done?", help: "Spreadsheets, PDFs, paper, email, personal templates or workarounds." },
      { id: "disconnected", type: "textarea", label: "Which tools don't talk to each other but should?" },
      { id: "itIssues", type: "textarea", label: "Any problems with licences, versions, installs or hardware?" }
    ] },
    { id: "design", title: "Design and delivery", icon: "grid", intro: "How projects are modelled, coordinated and documented. Skip any question that isn't part of your role.", fields: [
      { id: "revitVersions", type: "textarea", label: "Are projects and team members on the same Revit version? How are upgrades handled?" },
      { id: "consultants", type: "textarea", label: "How are models exchanged with structural, mechanical, electrical and envelope consultants, and how often?" },
      { id: "coordination", type: "textarea", label: "How are coordination and clash review handled? Who runs them?" },
      { id: "sheets", type: "textarea", label: "How long does it take to issue a drawing set or revision? What slows it down?" },
      { id: "ca", type: "textarea", label: "During construction, how do RFIs, submittals and markups move between the studio and site?" },
      { id: "standards", type: "textarea", label: "Are there office templates, families, detail libraries and standards? Who maintains them, and are they followed?" },
      { id: "prefab", type: "textarea", label: "When you work with fabricators or trades on prefabricated or timber components, how does design data reach them?" },
      { id: "viz", type: "textarea", label: "How are renderings and visualizations produced, and how much rework happens when the model changes?" },
      { id: "automation", type: "textarea", label: "Is anyone using Dynamo, Grasshopper, scripts or add-ins? Who maintains them?" }
    ] },
    { id: "frustrations", title: "Frustrations and issues", icon: "alert", intro: "The most useful part for us. The more specific, the better.", fields: [
      { id: "biggest", type: "textarea", label: "What is the single most frustrating part of your week?", required: true },
      { id: "slows", type: "textarea", label: "What slows you down most often?" },
      { pair: [
        { id: "frequency", type: "select", label: "How often does that happen?", options: ["Every day", "A few times a week", "Weekly", "Monthly", "Rarely"] },
        { id: "hoursLost", type: "select", label: "Hours it costs you per week", options: HOURS }
      ] },
      { id: "incident", type: "textarea", label: "Describe a recent time something went wrong", help: "A coordination miss, a late issue, rework. What caused it, and what did it cost?" },
      { id: "explainAgain", type: "textarea", label: "What do you find yourself explaining to new people over and over?" },
      { id: "singlePerson", type: "textarea", label: "Is there anything only one person knows how to do?" }
    ] },
    { id: "skills", title: "Skills and support", icon: "spark", intro: "How you learned your tools, and how well things are set up for you.", fields: [
      { id: "learned", type: "radio", label: "How did you learn your main tools?", options: ["Formal training", "Self-taught", "From colleagues", "A mix"] },
      { id: "lastTraining", type: "select", label: "When did you last have formal training?", options: ["In the last 6 months", "6–12 months ago", "1–2 years ago", "More than 2 years ago", "Never"] },
      { id: "trainingWanted", type: "textarea", label: "What training would help you most right now?" },
      { id: "stuck", type: "textarea", label: "When you're stuck, who or what do you go to?" },
      { id: "r_tools", type: "rating", label: "How well do your tools support the way you work?" },
      { id: "r_find", type: "rating", label: "How easy is it to find the latest version of a file or piece of information?" },
      { id: "r_handoffs", type: "rating", label: "How smooth are handoffs between you, other teams and consultants?" },
      { id: "r_confidence", type: "rating", label: "How confident are you using the advanced features of your main tools?" }
    ] },
    { id: "wrapup", title: "Wrap-up", icon: "flag", intro: "Last few questions.", fields: [
      { id: "magicWand", type: "textarea", label: "If you could change one thing about how the studio works, what would it be?", required: true },
      { id: "talkTo", type: "textarea", label: "Is there anyone else we should talk to?" },
      { id: "anythingElse", type: "textarea", label: "Anything else we should know?" },
      { id: "offRecord", type: "textarea", label: "Off the record", help: "Context for the consultant only. Never quoted or included in any report or analysis." },
      { id: "quoteOk", type: "radio", label: "May we quote your words, without your name, in the findings?", options: ["Yes, anonymously", "No, please don't quote me"] },
      { id: "researchOk", type: "radio", label: "May we include your anonymized answers in research that improves our assessment methods?", help: "Names and off-the-record notes are always removed.", options: ["Yes", "No"] }
    ] },
    { id: "review", title: "Review and submit", review: true }
  ];

  const MODELS = {
    confidential: { label: "Confidential", text: "Leadership sees themes and anonymous quotes only, never your name or anything that identifies you." },
    role: { label: "Reported by role", text: "Findings are reported by role or studio, not by your name." },
    named: { label: "Attributed", text: "Findings may be attributed to you by name in the report to leadership." }
  };
  const RATINGS = [["r_tools", "Tools support the way I work"], ["r_find", "Finding the latest information"], ["r_handoffs", "Handoffs between teams"], ["r_confidence", "Confidence with advanced features"]];

  const flat = s => (s.fields || []).flatMap(f => (f.pair ? f.pair : [f]));
  const allFields = () => SECTIONS.flatMap(flat);

  function fmt(f, v) {
    if (v == null || v === "" || (Array.isArray(v) && !v.length)) return "";
    if (f.type === "checks") return Array.isArray(v) ? v.join(", ") : String(v);
    if (f.type === "rating") return v + " / 5";
    if (f.type === "split") return f.parts.filter(([k]) => v[k] !== "" && v[k] != null).map(([k, l]) => `${l}: ${v[k]}%`).join(" · ");
    if (f.type === "steps") return (Array.isArray(v) ? v : []).filter(r => r && (r.what || r.tool || r.pain)).map((r, i) => `${i + 1}. ${r.what || "(step)"}${r.tool ? ` — ${r.tool}` : ""}${r.pain ? `\n   Issue: ${r.pain}` : ""}`).join("\n");
    if (f.type === "apps") return (Array.isArray(v) ? v : []).filter(r => r && r.name).map(r => `${r.name}${r.freq ? ` · ${r.freq}` : ""}${r.rating ? ` · ${r.rating}/5` : ""}${r.note ? ` · ${r.note}` : ""}`).join("\n");
    return String(v);
  }

  const api = { SECTIONS, MODELS, RATINGS, HOURS, HOURS_MID, flat, allFields, fmt };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.AA = api;
})(typeof window !== "undefined" ? window : globalThis);
