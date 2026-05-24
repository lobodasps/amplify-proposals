import "dotenv/config";
import mysql from "mysql2/promise";

const db = await mysql.createConnection(process.env.DATABASE_URL);

async function clearTables() {
  const tables = [
    "comments", "tasks", "tailored_resumes", "proposal_sections",
    "proposals", "pursuits", "contracts", "opportunities",
    "content_library", "assets", "personnel_projects", "personnel",
    "projects", "clients"
  ];
  await db.execute("SET FOREIGN_KEY_CHECKS = 0");
  for (const t of tables) {
    try { await db.execute(`TRUNCATE TABLE \`${t}\``); } catch(e) { console.warn(`  skip ${t}: ${e.message}`); }
  }
  await db.execute("SET FOREIGN_KEY_CHECKS = 1");
  console.log("Tables cleared.");
}

// ─── CLIENTS ──────────────────────────────────────────────────────────────────
async function seedClients() {
  console.log("Seeding clients...");
  const clients = [
    ["NYC Department of Transportation", "public_agency", "NY", "New York", "John Caruso", "jcaruso@dot.nyc.gov", "212-555-0101"],
    ["NJ Department of Transportation", "state", "NJ", "Trenton", "Maria Santos", "msantos@dot.nj.gov", "609-555-0102"],
    ["NYC Department of Design & Construction", "public_agency", "NY", "New York", "Robert Kim", "rkim@ddc.nyc.gov", "212-555-0103"],
    ["Port Authority of NY & NJ", "public_agency", "NY", "New York", "Susan Park", "spark@panynj.gov", "212-555-0104"],
    ["NJ Transit", "public_agency", "NJ", "Newark", "David Chen", "dchen@njtransit.com", "973-555-0105"],
    ["NYC Parks & Recreation", "public_agency", "NY", "New York", "Angela Torres", "atorres@parks.nyc.gov", "212-555-0106"],
    ["NYC School Construction Authority", "public_agency", "NY", "New York", "Michael Brown", "mbrown@nycsca.org", "718-555-0107"],
    ["NJ Turnpike Authority", "state", "NJ", "Woodbridge", "Patricia Lee", "plee@njta.com", "732-555-0108"],
    ["NYC Housing Authority", "public_agency", "NY", "New York", "James Wilson", "jwilson@nycha.nyc.gov", "212-555-0109"],
    ["Bergen County DPW", "municipal", "NJ", "Hackensack", "Thomas Rivera", "trivera@co.bergen.nj.us", "201-555-0110"],
  ];
  const ids = [];
  for (const [name, type, state, city, contactName, contactEmail, contactPhone] of clients) {
    const [res] = await db.execute(
      `INSERT INTO clients (name, type, state, city, contactName, contactEmail, contactPhone, totalAwardedValue, winCount, lossCount, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [name, type, state, city, contactName, contactEmail, contactPhone,
       Math.floor(Math.random() * 5000000) + 500000,
       Math.floor(Math.random() * 8) + 1,
       Math.floor(Math.random() * 4)]
    );
    ids.push(res.insertId);
  }
  console.log(`  ✓ ${ids.length} clients`);
  return ids;
}

// ─── PROJECTS ─────────────────────────────────────────────────────────────────
async function seedProjects(clientIds) {
  console.log("Seeding projects...");
  // service_line uses snake_case in DB
  const projects = [
    ["P-2024-001", "Route 1&9 Corridor Traffic Signal Modernization", clientIds[1], "NJ Department of Transportation", "traffic_engineering", "Complete traffic signal modernization along Route 1&9 corridor in Newark, including adaptive signal control technology and pedestrian safety improvements.", "Newark, NJ", "NJ", 2850000, "2022-03-15", "2024-06-30", "completed", "Delivered 47 modernized signal heads, reduced average intersection delay by 23%, improved pedestrian crossing compliance by 41%."],
    ["P-2024-002", "Brooklyn Bridge Approach Special Inspections", clientIds[0], "NYC Department of Transportation", "special_inspections", "Comprehensive special inspection program for Brooklyn Bridge approach structures including fracture-critical member inspection, fatigue analysis, and underwater inspection of pier foundations.", "Brooklyn, NY", "NY", 1200000, "2023-01-10", "2024-12-31", "active", "Completed 100% of above-water inspections, identified 3 critical deficiencies requiring immediate remediation, produced 847-page inspection report."],
    ["P-2023-003", "Prospect Park Landscape Restoration Phase II", clientIds[5], "NYC Parks & Recreation", "landscape_streetscape", "Ecological restoration of 12 acres of degraded woodland and meadow habitat within Prospect Park, including invasive species removal, native plantings, and stormwater bioswale installation.", "Brooklyn, NY", "NY", 890000, "2023-06-01", "2024-09-30", "active", "Removed 8 acres of invasive species, planted 2,400 native trees and shrubs, installed 3 bioswales capturing 1.2M gallons annually."],
    ["P-2023-004", "Lincoln Tunnel Ventilation Building CM Services", clientIds[3], "Port Authority of NY & NJ", "construction_management", "Construction management services for $45M rehabilitation of Lincoln Tunnel North Tube ventilation building, including mechanical, electrical, and structural upgrades.", "Weehawken, NJ", "NJ", 3400000, "2022-09-01", "2025-03-31", "active", "Managed 18 subcontractors, maintained 98.7% schedule compliance, achieved zero lost-time incidents through 340,000 work hours."],
    ["P-2022-005", "Phase I & II ESA — Kearny Redevelopment Site", clientIds[9], "Bergen County DPW", "environmental", "Phase I and Phase II Environmental Site Assessments for 34-acre former industrial site in Kearny, NJ, including soil and groundwater sampling, UST investigation, and remediation feasibility study.", "Kearny, NJ", "NJ", 425000, "2022-04-15", "2022-11-30", "completed", "Identified 4 areas of concern, conducted 28 soil borings and 12 monitoring wells, recommended targeted remediation saving client $2.1M vs full-site approach."],
    ["P-2024-006", "NJ Transit Morris & Essex Line Station Accessibility Upgrades", clientIds[4], "NJ Transit", "construction_management", "Construction management for ADA accessibility improvements at 6 Morris & Essex Line stations including elevator installation, platform gap mitigation, and tactile warning strip replacement.", "Morris County, NJ", "NJ", 1750000, "2023-11-01", "2025-06-30", "active", "Completed 3 of 6 stations on schedule, coordinating with active rail operations maintaining 100% service continuity."],
    ["P-2023-007", "Queens Boulevard Vision Zero Streetscape Phase 2", clientIds[0], "NYC Department of Transportation", "landscape_streetscape", "Complete streetscape redesign of 1.2-mile Queens Boulevard segment implementing Vision Zero safety improvements including protected bike lanes, pedestrian refuge islands, and street tree planting.", "Queens, NY", "NY", 2100000, "2023-03-01", "2024-08-31", "completed", "Installed 0.8 miles of protected bike infrastructure, planted 156 street trees, reduced pedestrian fatality risk by an estimated 67%."],
    ["P-2024-008", "NYC SCA PS 158 Structural Special Inspections", clientIds[6], "NYC School Construction Authority", "special_inspections", "Special inspection services for $28M structural renovation of PS 158 in Manhattan, including concrete, masonry, steel, and soil compaction inspections throughout construction.", "Manhattan, NY", "NY", 380000, "2024-01-15", "2025-01-14", "active", "Completed 1,240 inspection visits, maintained 100% inspection coverage, zero NCRs escalated to DOB."],
    ["P-2022-009", "NJ Turnpike Interchange 14 Traffic Operations Study", clientIds[7], "NJ Turnpike Authority", "traffic_engineering", "Comprehensive traffic operations study for Interchange 14 including turning movement counts, capacity analysis, microsimulation modeling, and interchange improvement alternatives analysis.", "Elizabeth, NJ", "NJ", 650000, "2022-07-01", "2023-04-30", "completed", "Developed 3 improvement alternatives, recommended $12M phased improvement program, projected 34% reduction in peak-hour delay."],
    ["P-2024-010", "Gowanus Canal Remediation Environmental Monitoring", clientIds[8], "NYC Housing Authority", "environmental", "Environmental monitoring and oversight services for EPA Superfund remediation of Gowanus Canal, including sediment sampling, air quality monitoring, and community health liaison services.", "Brooklyn, NY", "NY", 1100000, "2024-02-01", "2026-12-31", "active", "Established 24 monitoring stations, collected 480 sediment samples, produced 12 quarterly monitoring reports meeting all EPA reporting requirements."],
  ];
  const ids = [];
  for (const [projectNumber, name, clientId, clientName, serviceLine, description, location, state, contractValue, startDate, endDate, status, highlights] of projects) {
    const [res] = await db.execute(
      `INSERT INTO projects (name, projectNumber, clientId, clientName, service_line, description, location, state, contractValue, startDate, endDate, status, highlights, tags, isPublic, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
      [name, projectNumber, clientId, clientName, serviceLine, description, location, state, contractValue, startDate, endDate, status, highlights, JSON.stringify([serviceLine, state, "public_agency"])]
    );
    ids.push(res.insertId);
  }
  console.log(`  ✓ ${ids.length} projects`);
  return ids;
}

// ─── PERSONNEL ────────────────────────────────────────────────────────────────
async function seedPersonnel() {
  console.log("Seeding personnel...");
  const people = [
    ["Dr. Elena Vasquez, PE, DBIA", "Principal-in-Charge / Senior Traffic Engineer", "elena.vasquez@amplify.com", "201-555-1001", 28, "M.S. Civil Engineering, Rutgers University; B.S. Civil Engineering, NJIT", '["PE - NJ","PE - NY","DBIA"]', '["PMP","PTOE"]', '["traffic_engineering","construction_management"]', "Dr. Vasquez leads Amplify's traffic engineering practice with 28 years of experience on major NJ/NY transportation projects. She has served as principal-in-charge on over $200M in NJDOT, NJTPA, and NYCDOT contracts."],
    ["Marcus Johnson, PE, CCM", "Principal / Construction Management Practice Lead", "marcus.johnson@amplify.com", "212-555-1002", 24, "M.S. Construction Management, Columbia University; B.S. Civil Engineering, Howard University", '["PE - NJ","PE - NY","CCM"]', '["PMP","DBIA"]', '["construction_management","special_inspections"]', "Marcus leads Amplify's CM practice with expertise in transit, transportation, and institutional construction. He has managed over $1.2B in construction value for Port Authority, NJ Transit, and NYC SCA."],
    ["Priya Patel, PE", "Senior Environmental Engineer", "priya.patel@amplify.com", "973-555-1003", 16, "M.S. Environmental Engineering, Stevens Institute; B.S. Civil Engineering, Rutgers", '["PE - NJ","PE - NY"]', '["LEED AP","CHMM"]', '["environmental"]', "Priya specializes in Phase I/II ESAs, remedial investigations, and environmental permitting for brownfield redevelopment and infrastructure projects throughout NJ and NY."],
    ["James O'Brien, RLA", "Landscape Architect / Urban Designer", "james.obrien@amplify.com", "718-555-1004", 12, "M.L.A. Landscape Architecture, CUNY; B.S. Environmental Design, Rutgers", '["RLA - NJ","RLA - NY"]', '["LEED AP BD+C"]', '["landscape_streetscape"]', "James leads streetscape, parks, and urban design projects with a focus on Vision Zero implementation, green infrastructure, and community engagement for NYC and NJ municipal clients."],
    ["Dr. Kevin Chang, PE, SE", "Senior Structural Engineer / Special Inspections Lead", "kevin.chang@amplify.com", "212-555-1005", 19, "Ph.D. Structural Engineering, Columbia University; B.S. Civil Engineering, Cornell", '["PE - NJ","PE - NY","SE - NY"]', '["ICC Special Inspector","ACI"]', '["special_inspections","construction_management"]', "Dr. Chang leads Amplify's special inspections practice with expertise in bridge, building, and infrastructure inspections. He is a qualified ICC Special Inspector and has led inspection programs for NYC DDC, SCA, and DOT."],
    ["Sofia Rodriguez, PE", "Traffic Engineer / Project Manager", "sofia.rodriguez@amplify.com", "201-555-1006", 10, "B.S. Civil Engineering, NJIT", '["PE - NJ"]', '["PTOE","PMP"]', '["traffic_engineering"]', "Sofia manages traffic engineering projects including signal design, traffic impact studies, and safety analyses for NJDOT, county, and municipal clients throughout northern NJ."],
    ["David Park, PE, LEED AP", "Environmental / Permitting Project Manager", "david.park@amplify.com", "973-555-1007", 8, "M.S. Environmental Science, NJIT; B.S. Civil Engineering, Rutgers", '["PE - NJ"]', '["LEED AP","CHMM"]', '["environmental"]', "David manages environmental permitting, wetlands delineation, and NEPA documentation for transportation and infrastructure projects in NJ and NY."],
    ["Aisha Williams, PE", "Construction Manager / Resident Engineer", "aisha.williams@amplify.com", "212-555-1008", 9, "B.S. Civil Engineering, CCNY", '["PE - NY"]', '["CCM","PMP"]', '["construction_management","special_inspections"]', "Aisha serves as resident engineer on major NYC transit and transportation construction projects, with expertise in schedule management, RFI/submittal processing, and contractor coordination."],
    ["Ryan Nguyen, EIT", "Traffic / Transportation Analyst", "ryan.nguyen@amplify.com", "201-555-1009", 5, "B.S. Civil Engineering, Stevens Institute", '["EIT - NJ"]', '["PTOE (candidate)"]', '["traffic_engineering"]', "Ryan supports traffic operations analysis, signal timing optimization, and transportation planning studies. He is proficient in Synchro, SimTraffic, and VISSIM microsimulation software."],
    ["Linda Okonkwo, RLA, AICP", "Senior Landscape Architect / Planner", "linda.okonkwo@amplify.com", "718-555-1010", 14, "M.U.P. Urban Planning, Pratt Institute; B.L.A. Landscape Architecture, Penn State", '["RLA - NY","AICP"]', '["LEED AP ND"]', '["landscape_streetscape","environmental"]', "Linda leads parks, open space, and streetscape design projects with expertise in community engagement, environmental review, and green infrastructure for NYC Parks, DDC, and municipal clients."],
  ];
  const ids = [];
  for (const [name, title, email, phone, yearsExp, education, licenses, certs, serviceLines, summary] of people) {
    const [res] = await db.execute(
      `INSERT INTO personnel (name, title, email, phone, yearsExperience, education, licenses, certifications, serviceLines, summary, tags, isActive, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
      [name, title, email, phone, yearsExp, education, licenses, certs, serviceLines, summary, JSON.stringify(["active"])]
    );
    ids.push(res.insertId);
  }
  console.log(`  ✓ ${ids.length} personnel`);
  return ids;
}

// ─── ASSETS ───────────────────────────────────────────────────────────────────
async function seedAssets(personnelIds) {
  console.log("Seeding assets...");
  // asset_type uses snake_case in DB
  const assets = [
    ["Amplify Firm Overview Brochure 2024", "Comprehensive firm overview brochure highlighting capabilities, key projects, and team across all service lines.", "application/pdf", "document", "Firm Brochures", '["firm overview","brochure","marketing","capabilities"]', '["traffic_engineering","construction_management","special_inspections","landscape_streetscape","environmental"]'],
    ["Route 1&9 Signal Modernization — Aerial Photography", "High-resolution aerial photography of completed Route 1&9 signal modernization project showing before/after corridor improvements.", "image/jpeg", "image", "Project Photography", '["aerial","traffic","NJDOT","completed project","before-after"]', '["traffic_engineering"]'],
    ["Brooklyn Bridge Special Inspection — Underwater Photos", "Underwater inspection photography of Brooklyn Bridge pier foundations showing condition assessment findings.", "image/jpeg", "image", "Project Photography", '["bridge inspection","underwater","NYCDOT","special inspections"]', '["special_inspections"]'],
    ["Prospect Park Restoration — Planting Plan", "Detailed planting plan drawing for Prospect Park Phase II ecological restoration showing native species locations and bioswale design.", "application/pdf", "document", "Design Drawings", '["landscape","planting plan","NYC Parks","ecological restoration","bioswale"]', '["landscape_streetscape","environmental"]'],
    ["Lincoln Tunnel CM — Construction Progress Photos", "Construction progress photography documenting Lincoln Tunnel ventilation building rehabilitation milestones.", "image/jpeg", "image", "Project Photography", '["construction management","Port Authority","Lincoln Tunnel","progress photos"]', '["construction_management"]'],
    ["Amplify Traffic Engineering Capabilities Statement", "One-page capabilities statement for traffic engineering services highlighting NJDOT, NJTPA, and NYCDOT experience.", "application/pdf", "document", "Capabilities Statements", '["capabilities","traffic engineering","NJDOT","one-pager"]', '["traffic_engineering"]'],
    ["Special Inspections Program — Standard Scope Template", "Boilerplate scope of services template for special inspections programs adaptable to NYC DDC, SCA, and DOT contracts.", "text/plain", "document", "Proposal Templates", '["special inspections","scope template","boilerplate","NYC"]', '["special_inspections"]'],
    ["Environmental Services Capabilities Statement", "Two-page capabilities statement for environmental services including Phase I/II ESA, NEPA, wetlands, and remediation.", "application/pdf", "document", "Capabilities Statements", '["capabilities","environmental","Phase I ESA","NEPA","wetlands"]', '["environmental"]'],
    ["Queens Boulevard Streetscape — Rendered Perspectives", "Photorealistic renderings of Queens Boulevard Vision Zero streetscape redesign showing protected bike lanes and street trees.", "image/png", "image", "Design Renderings", '["streetscape","Vision Zero","Queens","rendering","bike lanes"]', '["landscape_streetscape"]'],
    ["Firm Logo — Primary (White Background)", "Primary Amplify firm logo in vector format on white background, suitable for proposal covers and marketing materials.", "image/svg+xml", "image", "Brand Assets", '["logo","brand","primary","white background"]', '["traffic_engineering","construction_management","special_inspections","landscape_streetscape","environmental"]'],
    ["NJ Transit Station Accessibility — Photo Documentation", "Comprehensive photo documentation of pre-construction conditions at 6 Morris & Essex Line stations.", "image/jpeg", "image", "Project Photography", '["NJ Transit","accessibility","ADA","stations","pre-construction"]', '["construction_management"]'],
    ["Gowanus Canal Monitoring — Site Photos", "Environmental monitoring site photography showing sampling locations and monitoring equipment at Gowanus Canal Superfund site.", "image/jpeg", "image", "Project Photography", '["environmental monitoring","Gowanus","Superfund","sampling","Brooklyn"]', '["environmental"]'],
  ];
  const ids = [];
  for (const [name, description, mimeType, assetType, folder, tags, serviceLines] of assets) {
    const safeName = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const ext = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/png' ? 'png' : mimeType === 'image/svg+xml' ? 'svg' : mimeType === 'application/pdf' ? 'pdf' : 'txt';
    const fileKey = `demo/assets/${safeName}.${ext}`;
    const fileUrl = `/manus-storage/${fileKey}`;
    const [res] = await db.execute(
      `INSERT INTO assets (name, description, fileKey, fileUrl, mimeType, asset_type, folder, tags, serviceLines, version, isPublic, uploadedBy, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, NOW(), NOW())`,
      [name, description, fileKey, fileUrl, mimeType, assetType, folder, tags, serviceLines, personnelIds[0]]
    );
    ids.push(res.insertId);
  }
  console.log(`  ✓ ${ids.length} assets`);
  return ids;
}

// ─── CONTENT LIBRARY (Knowledge Base) ────────────────────────────────────────
async function seedContentLibrary() {
  console.log("Seeding content library...");
  const items = [
    ["Firm Overview — Standard Boilerplate", "boilerplate", "Amplify Engineering & Environmental Consulting (Amplify) is a full-service AEC consulting firm with deep expertise in transportation engineering, construction management, special inspections, landscape architecture, and environmental services. Founded in 2005, Amplify has built an exceptional track record serving public agencies throughout New Jersey, New York, and the greater metropolitan region. Our team of 85 licensed engineers, architects, and environmental scientists brings technical excellence, responsiveness, and an unwavering commitment to quality to every engagement.", '["traffic_engineering","construction_management","special_inspections","landscape_streetscape","environmental"]', '["firm overview","boilerplate","about us"]'],
    ["Special Inspections — Service Line Description", "boilerplate", "Amplify's Special Inspections practice provides comprehensive inspection and testing services for building and infrastructure construction projects throughout New York and New Jersey. Our ICC-certified special inspectors and licensed engineers deliver concrete, masonry, steel, soil compaction, spray fireproofing, and structural observation services in full compliance with IBC Chapter 17, NYC Building Code, and project-specific inspection programs. We maintain a 100% on-time inspection response record and have completed over 500 special inspection programs for NYC DDC, NYC SCA, NYC DOT, and NJ public agencies.", '["special_inspections"]', '["special inspections","boilerplate","capabilities"]'],
    ["Construction Management — Service Line Description", "boilerplate", "Amplify's Construction Management practice delivers owner's representative and resident engineering services for complex public infrastructure projects. Our CCM-certified construction managers bring deep experience managing multi-prime contracts, coordinating with active transportation systems, and delivering projects on schedule and within budget. We have managed over $2B in construction value for Port Authority, NJ Transit, NYC DDC, and NYC SCA, maintaining an average schedule compliance rate of 97.3% across our active portfolio.", '["construction_management"]', '["construction management","boilerplate","capabilities"]'],
    ["Traffic Engineering — Service Line Description", "boilerplate", "Amplify's Traffic Engineering practice provides comprehensive traffic operations, safety, and design services for transportation agencies and municipalities throughout NJ and NY. Our PTOE-certified traffic engineers specialize in signal design and timing optimization, traffic impact studies, corridor safety analyses, adaptive signal control technology, and Vision Zero implementation. We have completed over 300 traffic engineering assignments for NJDOT, NJTPA, NYCDOT, and county and municipal clients.", '["traffic_engineering"]', '["traffic engineering","boilerplate","capabilities"]'],
    ["Environmental Services — Service Line Description", "boilerplate", "Amplify's Environmental Services practice provides Phase I and Phase II Environmental Site Assessments, NEPA documentation, wetlands delineation and permitting, remedial investigation and feasibility studies, and environmental monitoring services. Our CHMM-certified environmental scientists and licensed engineers have completed over 200 environmental assessments and permitting projects for transportation, infrastructure, and redevelopment clients throughout NJ and NY.", '["environmental"]', '["environmental","boilerplate","capabilities"]'],
    ["Landscape & Streetscape — Service Line Description", "boilerplate", "Amplify's Landscape Architecture and Streetscape practice creates vibrant, sustainable public spaces that enhance community livability and safety. Our licensed landscape architects and urban designers specialize in streetscape design, parks and open space planning, ecological restoration, green infrastructure, and Vision Zero safety improvements. We have completed over 150 landscape and streetscape projects for NYC Parks, NYC DOT, and NJ municipal clients.", '["landscape_streetscape"]', '["landscape","streetscape","boilerplate","capabilities"]'],
    ["Why Amplify — Differentiators Statement", "boilerplate", "Amplify distinguishes itself through three core commitments: Technical Excellence — our team includes 14 licensed PEs, 3 RLAs, 2 CCMs, and 6 ICC-certified special inspectors with an average of 16 years of relevant experience; Responsiveness — we maintain a 24-hour response commitment for all client inquiries and a 48-hour mobilization capability for urgent inspection needs; and Local Knowledge — our principals have worked exclusively in the NJ/NY/NYC market for their entire careers, giving us unmatched familiarity with local agency requirements, standards, and stakeholders.", '["traffic_engineering","construction_management","special_inspections","landscape_streetscape","environmental"]', '["differentiators","why amplify","boilerplate"]'],
    ["NYC Agency Experience Summary", "qualifications", "Amplify has served NYC agencies continuously since 2007, completing over 180 assignments for NYC DOT, NYC DDC, NYC Parks, NYC SCA, NYC Housing Authority, and the Port Authority of NY & NJ. Our principals maintain active relationships with agency project managers, design directors, and procurement offices, and we have a thorough understanding of NYC agency contracting requirements, DBE/MWBE compliance, and project delivery processes.", '["traffic_engineering","construction_management","special_inspections","landscape_streetscape","environmental"]', '["NYC","agency experience","boilerplate"]'],
    ["NJ Agency Experience Summary", "qualifications", "Amplify has served New Jersey public agencies since our founding, completing over 220 assignments for NJDOT, NJ Transit, NJTPA, NJ Turnpike Authority, and county and municipal clients throughout the state. Our NJ-based principals are deeply familiar with NJDOT Local Aid procedures, NJ Transit capital program requirements, NJDEP permitting processes, and county and municipal procurement practices.", '["traffic_engineering","construction_management","special_inspections","landscape_streetscape","environmental"]', '["NJ","New Jersey","agency experience","boilerplate"]'],
    ["SF 330 Section H — Additional Information Template", "other", "SECTION H — ADDITIONAL INFORMATION\n\nH.1 FIRM OVERVIEW\nAmplify Engineering & Environmental Consulting is a full-service AEC firm serving public agencies throughout NJ, NY, and the greater metropolitan region.\n\nH.2 QUALITY CONTROL PLAN\nAmplify maintains a rigorous Quality Control program under the direction of our QC Manager. All deliverables undergo a three-tier review process: (1) self-check by the preparer, (2) independent technical review by a senior engineer, and (3) principal review and sign-off. Our average first-submission acceptance rate is 94% across all active contracts.\n\nH.3 MWBE/DBE COMMITMENT\nAmplify is committed to meaningful MWBE/DBE participation on all public agency contracts. We actively identify and partner with qualified MWBE/DBE subconsultants and have consistently met or exceeded agency participation goals.", '["traffic_engineering","construction_management","special_inspections","landscape_streetscape","environmental"]', '["SF 330","template","Section H","boilerplate"]'],
  ];
  const ids = [];
  for (const [title, category, content, serviceLines, tags] of items) {
    const [res] = await db.execute(
      `INSERT INTO content_library (title, category, content, serviceLines, tags, isApproved, version, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, 1, 1, NOW(), NOW())`,
      [title, category, content, serviceLines, tags]
    );
    ids.push(res.insertId);
  }
  console.log(`  ✓ ${ids.length} content library items`);
  return ids;
}

// ─── OPPORTUNITIES ────────────────────────────────────────────────────────────
async function seedOpportunities(clientIds) {
  console.log("Seeding opportunities...");
  // go_no_go_decision and opp_status use snake_case in DB
  const opps = [
    ["RFQ 2025-001: On-Call Traffic Engineering Services", "RFQ-NJDOT-2025-001", clientIds[1], "NJ Department of Transportation", '["traffic_engineering"]', 1200000, "2025-07-15", "2025-05-01", 92, "Strong match: NJDOT incumbent, all required disciplines in-house, 8 qualifying projects, 3 PEs with NJDOT experience.", 88, "High strategic value — NJDOT on-call positions firm for 3-year pipeline. Strong incumbent advantage.", "go", "pursuing"],
    ["RFP 2025-047: Queens Boulevard Phase 3 Streetscape Design", "RFP-NYCDOT-2025-047", clientIds[0], "NYC Department of Transportation", '["landscape_streetscape","traffic_engineering"]', 3500000, "2025-08-30", "2025-05-10", 85, "Very strong match: completed Phase 1 & 2 of same corridor, team continuity advantage, all required services in-house.", 91, "Must pursue — direct continuation of existing work, highest probability of award.", "go", "pursuing"],
    ["RFQ 2025-112: Special Inspections On-Call — Capital Program", "RFQ-NYCSCA-2025-112", clientIds[6], "NYC School Construction Authority", '["special_inspections"]', 2000000, "2025-07-01", "2025-04-28", 90, "Excellent match: SCA incumbent, ICC-certified inspectors on staff, strong past performance record.", 87, "Core service line — pursue aggressively. SCA on-call is anchor contract for inspections practice.", "go", "pursuing"],
    ["RFP 2025-089: Gowanus Canal Area Environmental Monitoring", "RFP-NYCHA-2025-089", clientIds[8], "NYC Housing Authority", '["environmental"]', 850000, "2025-09-15", "2025-06-01", 78, "Good match: current Gowanus monitoring contract provides strong past performance, team continuity advantage.", 75, "Pursue — natural follow-on to current contract. Moderate competition expected.", "go", "pursuing"],
    ["RFQ 2025-203: Construction Management — Station Rehabilitation", "RFQ-NJTRANSIT-2025-203", clientIds[4], "NJ Transit", '["construction_management"]', 4200000, "2025-10-01", "2025-06-15", 82, "Strong match: active NJ Transit CM contract, CCM-certified staff, transit construction expertise.", 80, "High value — pursue with full team. Leverage existing NJ Transit relationship.", "go", "pursuing"],
    ["RFP 2025-156: Comprehensive Traffic Safety Study — Route 9", "RFP-NJDOT-2025-156", clientIds[1], "NJ Department of Transportation", '["traffic_engineering"]', 680000, "2025-08-01", "2025-05-20", 88, "Strong match: Route 9 corridor experience, NJDOT safety study methodology expertise.", 72, "Good fit but lower fee. Pursue if capacity allows — good for resume building.", "go", "pursuing"],
    ["RFQ 2025-078: Landscape Architecture On-Call Services", "RFQ-NYCPARKS-2025-078", clientIds[5], "NYC Parks & Recreation", '["landscape_streetscape","environmental"]', 1500000, "2025-07-20", "2025-05-05", 80, "Good match: Prospect Park project demonstrates NYC Parks experience, RLA on staff.", 78, "Pursue — NYC Parks on-call supports landscape practice growth strategy.", "go", "pursuing"],
    ["RFP 2025-334: Phase I/II ESA — Bergen County Portfolio", "RFP-BERGEN-2025-334", clientIds[9], "Bergen County DPW", '["environmental"]', 320000, "2025-06-30", "2025-04-15", 75, "Moderate match: Bergen County experience, Phase I/II expertise, but smaller fee scope.", 55, "Lower priority — pursue only if capacity available. Fee too small for dedicated pursuit team.", "no_go", "archived"],
    ["RFP 2025-445: Port Authority On-Call CM Services", "RFP-PANYNJ-2025-445", clientIds[3], "Port Authority of NY & NJ", '["construction_management","special_inspections"]', 8500000, "2025-11-15", "2025-07-01", 87, "Strong match: Lincoln Tunnel CM contract is directly relevant, Port Authority relationship established.", 85, "High value strategic pursuit — allocate full BD resources. Must win for CM practice growth.", "go", "pursuing"],
    ["RFQ 2025-501: NJ Turnpike On-Call Traffic Engineering", "RFQ-NJTA-2025-501", clientIds[7], "NJ Turnpike Authority", '["traffic_engineering"]', 950000, "2025-09-30", "2025-06-20", 70, "Moderate match: Interchange 14 study provides relevant experience, but limited Turnpike-specific portfolio.", 62, "Pursue selectively — good for expanding Turnpike client relationship.", "pending", "reviewing"],
  ];
  const ids = [];
  for (const [title, rfpNumber, clientId, clientName, serviceLines, estimatedValue, dueDate, publishedDate, aiScore, aiScoreReason, goNoGoScore, goNoGoNotes, goNoGoDecision, status] of opps) {
    const [res] = await db.execute(
      `INSERT INTO opportunities (title, rfpNumber, clientId, clientName, serviceLines, estimatedValue, dueDate, publishedDate, aiScore, aiScoreReason, goNoGoScore, goNoGoNotes, go_no_go_decision, opp_status, opportunity_source, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', NOW(), NOW())`,
      [title, rfpNumber, clientId, clientName, serviceLines, estimatedValue, dueDate, publishedDate, aiScore, aiScoreReason, goNoGoScore, goNoGoNotes, goNoGoDecision, status]
    );
    ids.push(res.insertId);
  }
  console.log(`  ✓ ${ids.length} opportunities`);
  return ids;
}

// ─── PURSUITS ─────────────────────────────────────────────────────────────────
async function seedPursuits(clientIds, opportunityIds, personnelIds) {
  console.log("Seeding pursuits...");
  // pursuit_status uses snake_case in DB
  const pursuits = [
    [opportunityIds[0], "NJDOT On-Call Traffic Engineering Services 2025", "RFQ-NJDOT-2025-001", clientIds[1], "NJ Department of Transportation", '["traffic_engineering"]', "pursue", 1200000, 85, "2025-07-15", personnelIds[0], personnelIds[1], 88, "Strong incumbent advantage. Lead with Route 1&9 and Interchange 14 projects. Emphasize PTOE certifications and NJDOT familiarity.", '["Proven NJDOT track record","PTOE-certified team","Adaptive signal expertise","Rapid mobilization"]', "Competitor A likely to submit — strong traffic practice. Competitor B rumored to be teaming with subconsultant.", 0, null, null],
    [opportunityIds[1], "Queens Boulevard Phase 3 Streetscape Design", "RFP-NYCDOT-2025-047", clientIds[0], "NYC Department of Transportation", '["landscape_streetscape","traffic_engineering"]', "pursue", 3500000, 90, "2025-08-30", personnelIds[3], personnelIds[1], 91, "Must-win pursuit. Direct continuation of Phase 1 & 2 work. Emphasize team continuity, lessons learned, and community relationships.", '["Phase 1 & 2 continuity","Community trust built","Vision Zero expertise","Integrated design team"]', "One known competitor — strong landscape firm but no prior Queens Blvd experience.", 0, null, null],
    [opportunityIds[2], "NYC SCA Special Inspections On-Call Capital Program", "RFQ-NYCSCA-2025-112", clientIds[6], "NYC School Construction Authority", '["special_inspections"]', "submit", 2000000, 87, "2025-07-01", personnelIds[4], personnelIds[1], 87, "Shortlisted — interview scheduled for June 12. Prepare presentation emphasizing zero NCR escalations and 100% coverage record.", '["SCA incumbent","Zero NCR escalations","ICC-certified inspectors","24-hr response"]', "Two other firms shortlisted. We have strongest SCA track record.", 0, null, null],
    [opportunityIds[3], "Gowanus Canal Environmental Monitoring Follow-On", "RFP-NYCHA-2025-089", clientIds[8], "NYC Housing Authority", '["environmental"]', "pursue", 850000, 75, "2025-09-15", personnelIds[2], personnelIds[1], 75, "Follow-on to current contract. Emphasize continuity, established monitoring network, and EPA relationship.", '["Current contract continuity","Established monitoring network","EPA relationship","Data continuity"]', "Unknown competition — likely 3-4 firms. Our incumbent status is key differentiator.", 0, null, null],
    [opportunityIds[5], "NJDOT Route 9 Comprehensive Traffic Safety Study", "RFP-NJDOT-2025-156", clientIds[1], "NJ Department of Transportation", '["traffic_engineering"]', "pursue", 680000, 72, "2025-08-01", personnelIds[5], personnelIds[0], 72, "Solid pursuit. Lead with Route 1&9 safety improvements as analogous project. Highlight microsimulation capabilities.", '["NJDOT safety expertise","Microsimulation capability","Local knowledge","Rapid turnaround"]', "Competitive field — 5-6 firms expected to submit.", 0, null, null],
    [opportunityIds[8], "Port Authority On-Call CM Services 2025", "RFP-PANYNJ-2025-445", clientIds[3], "Port Authority of NY & NJ", '["construction_management","special_inspections"]', "qualify", 8500000, 85, "2025-11-15", personnelIds[1], personnelIds[1], 85, "Strategic must-pursue. Largest opportunity in current pipeline. Lincoln Tunnel CM contract is our strongest reference.", '["Lincoln Tunnel CM track record","CCM-certified team","Active PA relationship","$1.2B CM experience"]', "Will be highly competitive — expect 8-10 firms. Need to identify teaming partners for subconsultant capacity.", 0, null, null],
    [opportunityIds[6], "NYC Parks Landscape Architecture On-Call Services", "RFQ-NYCPARKS-2025-078", clientIds[5], "NYC Parks & Recreation", '["landscape_streetscape","environmental"]', "award", 1500000, 80, "2025-07-20", personnelIds[3], personnelIds[1], 78, "AWARDED — Contract execution in progress. Mobilization meeting scheduled.", '["Prospect Park track record","NYC Parks relationship","Ecological expertise","Community engagement"]', null, 1, 1500000, null],
    [null, "NJ Transit Morris & Essex On-Call CM Phase 2", "RFQ-NJTRANSIT-2024-089", clientIds[4], "NJ Transit", '["construction_management"]', "lost", 3200000, 78, "2024-12-15", personnelIds[1], personnelIds[1], 78, "Lost to Competitor C — debriefing scheduled. They offered lower fee and larger team.", '["Active NJ Transit contract","Transit CM expertise","CCM team","Schedule compliance record"]', "Lost to larger firm with lower overhead rate. Need to address pricing strategy for next NJ Transit pursuit.", 0, null, "Lower overhead rate — competitor offered 12% lower fee. Need to review indirect cost rate strategy."],
  ];
  const ids = [];
  for (const [opportunityId, title, rfpNumber, clientId, clientName, serviceLines, status, estimatedValue, probability, dueDate, leadId, coordinatorId, goNoGoScore, goNoGoNotes, winThemes, competitorNotes, isWon, awardedValue, lostReason] of pursuits) {
    const [res] = await db.execute(
      `INSERT INTO pursuits (opportunityId, title, rfpNumber, clientId, clientName, serviceLines, pursuit_status, estimatedValue, probability, dueDate, leadId, coordinatorId, goNoGoScore, goNoGoNotes, winThemes, competitorNotes, isWon, awardedValue, lostReason, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [opportunityId, title, rfpNumber, clientId, clientName, serviceLines, status, estimatedValue, probability, dueDate, leadId, coordinatorId, goNoGoScore, goNoGoNotes, winThemes, competitorNotes, isWon, awardedValue, lostReason]
    );
    ids.push(res.insertId);
  }
  console.log(`  ✓ ${ids.length} pursuits`);
  return ids;
}

// ─── PROPOSALS ────────────────────────────────────────────────────────────────
async function seedProposals(pursuitIds, clientIds, personnelIds) {
  console.log("Seeding proposals...");
  // proposal_status uses snake_case in DB
  const proposals = [
    [pursuitIds[1], "Queens Boulevard Phase 3 Streetscape Design — Technical Proposal", "RFP-NYCDOT-2025-047", clientIds[0], "NYC Department of Transportation", '["landscape_streetscape","traffic_engineering"]', "in_review", "2025-08-30", null, personnelIds[1], 87, JSON.stringify([{req: "Minimum 5 years NYC streetscape experience", status: "met", notes: "Phase 1 & 2 of same corridor"}, {req: "Licensed Landscape Architect on team", status: "met", notes: "James O'Brien, RLA"}, {req: "Traffic engineering subcapability", status: "met", notes: "In-house PE team"}, {req: "Community engagement experience", status: "met", notes: "Documented in Phase 2"}, {req: "MWBE participation plan", status: "partial", notes: "Identifying MWBE subconsultant"}])],
    [pursuitIds[2], "NYC SCA Special Inspections On-Call — Qualifications Package", "RFQ-NYCSCA-2025-112", clientIds[6], "NYC School Construction Authority", '["special_inspections"]', "in_review", "2025-07-01", null, personnelIds[4], 95, JSON.stringify([{req: "ICC Special Inspector certification", status: "met", notes: "Dr. Chang, ICC certified"}, {req: "NYC Building Code familiarity", status: "met", notes: "Documented in SCA past performance"}, {req: "24-hour mobilization capability", status: "met", notes: "Stated in cover letter"}, {req: "Minimum 3 SCA projects", status: "met", notes: "8 qualifying SCA projects listed"}])],
    [pursuitIds[0], "NJDOT On-Call Traffic Engineering — Statement of Qualifications", "RFQ-NJDOT-2025-001", clientIds[1], "NJ Department of Transportation", '["traffic_engineering"]', "submitted", "2025-07-15", "2025-06-28", personnelIds[0], 92, JSON.stringify([{req: "PTOE-certified traffic engineer", status: "met", notes: "Dr. Vasquez and Sofia Rodriguez"}, {req: "NJDOT project experience", status: "met", notes: "Route 1&9, Interchange 14 listed"}, {req: "Adaptive signal control experience", status: "met", notes: "Route 1&9 ASCT implementation"}, {req: "NJ PE license", status: "met", notes: "Multiple PEs on team"}])],
    [pursuitIds[6], "NYC Parks Landscape On-Call — Award Package", "RFQ-NYCPARKS-2025-078", clientIds[5], "NYC Parks & Recreation", '["landscape_streetscape","environmental"]', "awarded", "2025-07-20", "2025-06-15", personnelIds[3], 98, JSON.stringify([{req: "RLA on staff", status: "met", notes: "James O'Brien and Linda Okonkwo"}, {req: "NYC Parks experience", status: "met", notes: "Prospect Park Phase I & II"}, {req: "Ecological restoration experience", status: "met", notes: "Documented in Prospect Park project"}, {req: "Green infrastructure design", status: "met", notes: "Bioswale design experience"}])],
  ];
  const ids = [];
  for (const [pursuitId, title, rfpNumber, clientId, clientName, serviceLines, status, dueDate, submittedDate, coordinatorId, complianceScore, requirementsMatrix] of proposals) {
    const [res] = await db.execute(
      `INSERT INTO proposals (pursuitId, title, rfpNumber, clientId, clientName, serviceLines, proposal_status, dueDate, submittedDate, coordinatorId, requirementsMatrix, complianceScore, selectedPersonnelIds, selectedProjectIds, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [pursuitId, title, rfpNumber, clientId, clientName, serviceLines, status, dueDate, submittedDate, coordinatorId, requirementsMatrix, complianceScore, JSON.stringify([personnelIds[0], personnelIds[3], personnelIds[4]]), JSON.stringify([1, 2, 3])]
    );
    ids.push(res.insertId);
  }
  console.log(`  ✓ ${ids.length} proposals`);
  return ids;
}

// ─── CONTRACTS ────────────────────────────────────────────────────────────────
async function seedContracts(pursuitIds, clientIds, personnelIds, projectIds) {
  console.log("Seeding contracts...");
  // contract_status uses snake_case in DB
  const contracts = [
    [null, null, projectIds[3], clientIds[3], "Port Authority of NY & NJ", "Lincoln Tunnel Ventilation Building CM Services", "C-2022-PANYNJ-0847", "active", 3400000, "2022-09-01", "2025-03-31", "2022-08-15", '["construction_management"]', personnelIds[1], JSON.stringify([{title: "NTP Issued", date: "2022-09-01", status: "complete"}, {title: "50% Construction Complete", date: "2024-01-15", status: "complete"}, {title: "Substantial Completion", date: "2025-01-31", status: "pending"}, {title: "Final Completion", date: "2025-03-31", status: "pending"}])],
    [null, null, projectIds[1], clientIds[0], "NYC Department of Transportation", "Brooklyn Bridge Approach Special Inspections", "C-2023-NYCDOT-1204", "active", 1200000, "2023-01-10", "2024-12-31", "2022-12-20", '["special_inspections"]', personnelIds[4], JSON.stringify([{title: "Contract Execution", date: "2023-01-10", status: "complete"}, {title: "Phase 1 Inspection Complete", date: "2023-08-31", status: "complete"}, {title: "Phase 2 Inspection Complete", date: "2024-06-30", status: "complete"}, {title: "Final Report Submission", date: "2024-12-31", status: "pending"}])],
    [pursuitIds[6], null, null, clientIds[5], "NYC Parks & Recreation", "Landscape Architecture On-Call Services", "C-2025-NYCPARKS-0312", "executed", 1500000, "2025-08-01", "2028-07-31", "2025-07-20", '["landscape_streetscape","environmental"]', personnelIds[3], JSON.stringify([{title: "Contract Award", date: "2025-07-20", status: "complete"}, {title: "Contract Execution", date: "2025-08-01", status: "pending"}, {title: "NTP", date: "2025-08-15", status: "pending"}])],
    [null, null, projectIds[5], clientIds[4], "NJ Transit", "Morris & Essex Line Station Accessibility CM", "C-2023-NJTRANSIT-0567", "active", 1750000, "2023-11-01", "2025-06-30", "2023-10-15", '["construction_management"]', personnelIds[7], JSON.stringify([{title: "NTP Issued", date: "2023-11-01", status: "complete"}, {title: "Station 1-3 Complete", date: "2024-09-30", status: "complete"}, {title: "Station 4-6 Complete", date: "2025-04-30", status: "pending"}, {title: "Final Closeout", date: "2025-06-30", status: "pending"}])],
    [null, null, projectIds[9], clientIds[8], "NYC Housing Authority", "Gowanus Canal Environmental Monitoring", "C-2024-NYCHA-0891", "active", 1100000, "2024-02-01", "2026-12-31", "2024-01-15", '["environmental"]', personnelIds[2], JSON.stringify([{title: "Contract Execution", date: "2024-02-01", status: "complete"}, {title: "Year 1 Annual Report", date: "2025-01-31", status: "complete"}, {title: "Year 2 Annual Report", date: "2026-01-31", status: "pending"}, {title: "Final Report", date: "2026-12-31", status: "pending"}])],
  ];
  const ids = [];
  for (const [proposalId, pursuitId, projectId, clientId, clientName, title, contractNumber, status, value, startDate, endDate, executionDate, serviceLines, contractManagerId, milestones] of contracts) {
    const [res] = await db.execute(
      `INSERT INTO contracts (proposalId, pursuitId, projectId, clientId, clientName, title, contractNumber, contract_status, value, startDate, endDate, executionDate, serviceLines, contractManagerId, milestones, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [proposalId, pursuitId, projectId, clientId, clientName, title, contractNumber, status, value, startDate, endDate, executionDate, serviceLines, contractManagerId, milestones]
    );
    ids.push(res.insertId);
  }
  console.log(`  ✓ ${ids.length} contracts`);
  return ids;
}

// ─── TASKS ────────────────────────────────────────────────────────────────────
async function seedTasks(proposalIds, personnelIds) {
  console.log("Seeding tasks...");
  // task_status uses snake_case in DB
  const tasks = [
    [proposalIds[0], null, "Draft Technical Approach Section", "Develop 8-page technical approach for Queens Boulevard Phase 3 including methodology, community engagement plan, and Vision Zero integration strategy.", personnelIds[3], personnelIds[1], "in_progress", "high", "2025-07-15"],
    [proposalIds[0], null, "Prepare Project Experience Matrix", "Compile and format 5 most relevant streetscape projects for Section F. Include Queens Boulevard Phase 1 & 2 as lead examples.", personnelIds[3], personnelIds[1], "open", "high", "2025-07-20"],
    [proposalIds[0], null, "Collect Updated Resumes — Landscape Team", "Collect and update resumes for James O'Brien, Linda Okonkwo, and Ryan Nguyen. Tailor to Queens Boulevard RFP requirements.", personnelIds[3], personnelIds[1], "open", "medium", "2025-07-25"],
    [proposalIds[0], null, "Identify MWBE Subconsultant", "Research and contact qualified MWBE landscape or environmental subconsultants for Queens Boulevard Phase 3 to meet NYC MWBE participation requirements.", personnelIds[1], personnelIds[1], "review", "high", "2025-07-10"],
    [proposalIds[1], null, "Prepare Interview Presentation", "Develop 20-minute interview presentation for NYC SCA shortlist interview on June 12. Focus on inspection program management, zero NCR record, and 24-hour response capability.", personnelIds[4], personnelIds[1], "in_progress", "high", "2025-06-10"],
    [proposalIds[1], null, "Update SCA Project List", "Compile complete list of SCA inspection projects with contract values, dates, and key performance metrics for interview leave-behind.", personnelIds[4], personnelIds[1], "done", "high", "2025-06-05"],
    [proposalIds[2], null, "Final QC Review — NJDOT SOQ", "Conduct final quality control review of NJDOT Statement of Qualifications before submission. Check all page limits, required forms, and certifications.", personnelIds[0], personnelIds[0], "done", "high", "2025-06-27"],
  ];
  const ids = [];
  for (const [proposalId, pursuitId, title, description, assignedTo, assignedBy, status, priority, dueDate] of tasks) {
    const [res] = await db.execute(
      `INSERT INTO tasks (proposalId, pursuitId, title, description, assignedTo, assignedBy, task_status, priority, dueDate, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [proposalId, pursuitId, title, description, assignedTo, assignedBy, status, priority, dueDate]
    );
    ids.push(res.insertId);
  }
  console.log(`  ✓ ${ids.length} tasks`);
  return ids;
}

// ─── PERSONNEL PROJECTS ───────────────────────────────────────────────────────
async function seedPersonnelProjects(personnelIds, projectIds) {
  console.log("Seeding personnel-project assignments...");
  const assignments = [
    [personnelIds[0], projectIds[0], "Principal-in-Charge"],
    [personnelIds[5], projectIds[0], "Project Manager"],
    [personnelIds[4], projectIds[1], "Lead Inspector"],
    [personnelIds[7], projectIds[1], "Resident Engineer"],
    [personnelIds[3], projectIds[2], "Project Manager"],
    [personnelIds[9], projectIds[2], "Senior Landscape Architect"],
    [personnelIds[1], projectIds[3], "Principal-in-Charge"],
    [personnelIds[7], projectIds[3], "Resident Engineer"],
    [personnelIds[2], projectIds[4], "Project Manager"],
    [personnelIds[6], projectIds[4], "Environmental Scientist"],
    [personnelIds[1], projectIds[5], "Principal-in-Charge"],
    [personnelIds[7], projectIds[5], "Construction Manager"],
    [personnelIds[3], projectIds[6], "Project Manager"],
    [personnelIds[9], projectIds[6], "Senior Designer"],
    [personnelIds[4], projectIds[7], "Lead Inspector"],
    [personnelIds[0], projectIds[8], "Principal-in-Charge"],
    [personnelIds[5], projectIds[8], "Traffic Engineer"],
    [personnelIds[2], projectIds[9], "Project Manager"],
    [personnelIds[6], projectIds[9], "Environmental Scientist"],
  ];
  for (const [personnelId, projectId, role] of assignments) {
    try {
      await db.execute(
        `INSERT IGNORE INTO personnel_projects (personnelId, projectId, role) VALUES (?, ?, ?)`,
        [personnelId, projectId, role]
      );
    } catch(e) { console.warn(`  skip assignment: ${e.message}`); }
  }
  console.log(`  ✓ ${assignments.length} personnel-project assignments`);
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n🌱 Seeding Amplify-Proposals database...\n");
  try {
    await clearTables();
    const clientIds = await seedClients();
    const projectIds = await seedProjects(clientIds);
    const personnelIds = await seedPersonnel();
    await seedAssets(personnelIds);
    await seedContentLibrary();
    const opportunityIds = await seedOpportunities(clientIds);
    const pursuitIds = await seedPursuits(clientIds, opportunityIds, personnelIds);
    const proposalIds = await seedProposals(pursuitIds, clientIds, personnelIds);
    await seedContracts(pursuitIds, clientIds, personnelIds, projectIds);
    await seedTasks(proposalIds, personnelIds);
    await seedPersonnelProjects(personnelIds, projectIds);

    console.log("\n✅ Database seeded successfully!\n");
    console.log("Summary:");
    console.log("  • 10 clients (NYC DOT, NJDOT, DDC, Port Authority, NJ Transit, NYC Parks, SCA, NJTA, NYCHA, Bergen County)");
    console.log("  • 10 projects across all 5 service lines");
    console.log("  • 10 personnel with licenses, certifications, and resumes");
    console.log("  • 12 digital assets (photos, drawings, brochures, templates)");
    console.log("  • 10 content library items (boilerplate, templates, qualifications)");
    console.log("  • 10 opportunities with AI scores and go/no-go decisions");
    console.log("  • 8 pursuits at various pipeline stages");
    console.log("  • 4 proposals with compliance matrices");
    console.log("  • 5 contracts with milestones");
    console.log("  • 7 tasks with assignments");
    console.log("  • 19 personnel-project assignments\n");
  } catch (err) {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  } finally {
    await db.end();
  }
}

main();
