// "When to see a doctor": rule-based, every rule tied to a published source.
import { SOURCES } from "./knowledge.js";

const $ = (s) => document.querySelector(s);
const src = (k) => `<a href="${SOURCES[k].url}" target="_blank" rel="noopener">${SOURCES[k].label}</a>`;
const ACS_SCREEN = {
  label: "American Cancer Society — Recommendations for the early detection of breast cancer",
  url: "https://www.cancer.org/cancer/types/breast-cancer/screening-tests-and-early-detection/american-cancer-society-recommendations-for-the-early-detection-of-breast-cancer.html",
};
const NHS = { label: "NHS — Breast cancer in women: symptoms", url: "https://www.nhs.uk/conditions/breast-cancer-in-women/symptoms/" };
const NICE = { label: "NICE NG12 — Suspected cancer: recognition and referral (breast)", url: "https://www.nice.org.uk/guidance/ng12/chapter/Recommendations-organised-by-site-of-cancer" };
const link = (s) => `<a href="${s.url}" target="_blank" rel="noopener">${s.label}</a>`;

const SYMPTOMS = [
  ["lump", "A new lump in the breast or underarm (armpit)"],
  ["thick", "Thickening or swelling of part of the breast, even without a lump"],
  ["dimple", "Irritation or dimpling of the breast skin (can look like orange peel)"],
  ["red", "Redness or flaky skin on the nipple area or the breast"],
  ["nipple", "The nipple pulling inward, or pain in the nipple area"],
  ["discharge", "Nipple discharge other than breast milk, including blood"],
  ["shape", "Any change in the size or shape of the breast"],
  ["nodes", "Swollen lymph nodes under the arm or near the collarbone"],
  ["ibc", "The breast became red, swollen and warm over just a few weeks, across a large part of it"],
  ["pain", "Pain in any area of the breast"],
];

export function initCheck() {
  $("#symptoms").innerHTML = SYMPTOMS.map(([id, t]) =>
    `<label><input type="checkbox" data-s="${id}"> <span>${t}</span></label>`).join("");
  document.querySelectorAll("#check input, #check select").forEach((el) => el.addEventListener("input", update));
  update();
}

function update() {
  const s = new Set([...document.querySelectorAll("[data-s]:checked")].map((x) => x.dataset.s));
  const age = Math.round(+$("#p-age").value || 0);
  const female = $("#p-sex").value === "f";
  const f = (id) => $("#" + id).checked;
  const out = [];

  // ---- symptoms
  const changes = [...s].filter((x) => x !== "pain" && x !== "ibc");
  if (s.has("ibc")) {
    out.push(`<div class="advice act"><h3>See a doctor right away — within days, not weeks.</h3>
      <p>Redness, swelling and warmth that develop over weeks are most often an infection, but they are also the typical signs of
      <b>inflammatory breast cancer</b>, a rare type that grows quickly and often has no lump. If you were treated for an infection and it is not
      getting better, go back and ask about breast imaging.</p><p class="src">${src("acsIbc")}</p></div>`);
  }
  if (changes.length) {
    out.push(`<div class="advice act"><h3>Book an appointment with a doctor soon. Don’t wait for your next screening.</h3>
      <p>You ticked ${changes.length === 1 ? "a change" : changes.length + " changes"} that the CDC and American Cancer Society list as possible signs of breast cancer.
      Most breast changes turn out <b>not</b> to be cancer — but each one deserves a check, even if your last mammogram was normal.</p>
      ${s.has("lump") && age >= 30 ? `<p>In the UK, NICE guidance says adults aged 30 and over with an unexplained breast lump should be referred on the suspected-cancer pathway (diagnosed or ruled out within 28 days).</p>` : ""}
      <p class="src">${src("cdcSigns")}; ${src("acsSigns")}${s.has("lump") && age >= 30 ? "; " + link(NICE) : ""}</p></div>`);
  }
  if (s.has("pain") && !changes.length && !s.has("ibc")) {
    const fam = f("p-fam1") || f("p-fam2") || f("p-ovarian");
    out.push(`<div class="advice watch"><h3>${fam ? "Mention this pain to a doctor." : "Breast pain alone is not usually a sign of cancer."}</h3>
      <p>Breast pain is very common and is often linked to hormones. See a doctor if it doesn’t go away, is in one spot, or comes with any of the changes above.
      ${fam ? "Because you have a family history of breast or ovarian cancer, the NHS advises seeing a GP about breast pain." : ""}</p>
      <p class="src">${link(NHS)}</p></div>`);
  }
  if (!s.size) {
    out.push(`<div class="advice ok"><h3>No warning signs ticked.</h3>
      <p>Get to know how your breasts normally look and feel, so you notice changes early. Check again here if something changes.</p>
      <p class="src">${src("cdcSigns")}</p></div>`);
  }

  // ---- screening
  const highRisk = f("p-brca") || f("p-rad");
  const famAny = f("p-fam1") || f("p-fam2") || f("p-ovarian") || f("p-young") || f("p-ashk");
  let screen;
  if (!female) {
    screen = `<h3>Screening: not routine for men</h3><p>Men can get breast cancer too (about 1 in 100 breast cancers), so any lump or nipple change should be checked.
      Men from families with BRCA gene changes should ask about genetic counseling.</p><p class="src">${link({ label: "CDC — Breast cancer in men", url: "https://www.cdc.gov/breast-cancer/about/men.html" })}</p>`;
  } else if (highRisk) {
    screen = `<h3>You may need a high-risk screening plan.</h3>
      <p>The USPSTF guideline is for people at <b>average</b> risk. For people with a BRCA (or similar) gene change, or chest radiation between ages 10 and 30,
      the American Cancer Society recommends a <b>yearly MRI and mammogram, usually starting at age 30</b>. Ask your doctor or a genetics clinic for a plan.</p>
      <p class="src">${link(ACS_SCREEN)}</p>`;
  } else if (age < 40) {
    screen = `<h3>Routine mammograms usually start at 40.</h3><p>For average-risk women the USPSTF recommends a mammogram every 2 years from age 40 to 74.
      ${famAny ? "With a family history, talk with your doctor before 40 about whether you need an earlier or different plan." : "Before then, focus on knowing what is normal for you."}</p>
      <p class="src">${src("uspstf")}</p>`;
  } else if (age <= 74) {
    screen = `<h3>Recommended: a screening mammogram every 2 years.</h3>
      <p>The U.S. Preventive Services Task Force (April 2024) recommends <b>biennial screening mammography for women aged 40 to 74</b>. If yours is due, book it.</p>
      <p class="src">${src("uspstf")}</p>`;
  } else {
    screen = `<h3>At 75 and over, decide together with your doctor.</h3><p>The USPSTF found the evidence insufficient to recommend for or against screening after 74;
      your health and preferences matter most.</p><p class="src">${src("uspstf")}</p>`;
  }
  out.push(`<div class="advice info">${screen}</div>`);

  if (famAny) {
    out.push(`<div class="advice info"><h3>Your family history matters — ask about a family-risk assessment.</h3>
      <p>The USPSTF recommends that women with a personal or family history of breast, ovarian, tubal or peritoneal cancer, or an ancestry linked to BRCA1/2
      gene changes (such as Ashkenazi Jewish), are assessed with a brief familial-risk tool; if it is positive, genetic counseling follows.
      ${f("p-fam1") ? "Having one first-degree relative (mother, sister, daughter) with breast cancer almost doubles a woman’s risk." : ""}
      ${f("p-fam2") && !f("p-fam1") ? "A grandmother’s or aunt’s breast cancer counts too — especially if it was diagnosed young or several relatives on the same side were affected." : ""}
      Most women with a family history never get breast cancer; it is a reason to plan, not to panic.</p>
      <p class="src">${src("uspstfBrca")}; ${src("acsRisk")}</p></div>`);
  }
  $("#check-out").innerHTML = out.join("");
}
