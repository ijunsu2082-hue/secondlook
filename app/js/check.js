// "When to see a doctor": rule-based, every rule tied to a published source.
import { SOURCES } from "./knowledge.js";

const $ = (s) => document.querySelector(s);
const src = (k) => `<a href="${SOURCES[k].url}" target="_blank" rel="noopener">${SOURCES[k].label}</a>`;
const ACS_SCREEN = {
  label: "American Cancer Society: Advice on finding breast cancer early",
  url: "https://www.cancer.org/cancer/types/breast-cancer/screening-tests-and-early-detection/american-cancer-society-recommendations-for-the-early-detection-of-breast-cancer.html",
};
const NHS = { label: "NHS (UK): Breast cancer symptoms in women", url: "https://www.nhs.uk/conditions/breast-cancer-in-women/symptoms/" };
const NICE = { label: "NICE (UK): When to refer for suspected breast cancer", url: "https://www.nice.org.uk/guidance/ng12/chapter/Recommendations-organised-by-site-of-cancer" };
const link = (s) => `<a href="${s.url}" target="_blank" rel="noopener">${s.label}</a>`;

const SYMPTOMS = [
  ["lump", "A new lump in the breast or armpit"],
  ["thick", "Part of the breast feels thicker or swollen, even without a lump"],
  ["dimple", "Itchy or irritated skin on the breast, or dimpling that can look like orange peel"],
  ["red", "Red or flaky skin on the nipple area or the breast"],
  ["nipple", "The nipple turning inward, or pain in the nipple area"],
  ["discharge", "Fluid coming from the nipple that is not breast milk, including blood"],
  ["shape", "A change in the size or shape of the breast"],
  ["nodes", "Swollen lymph nodes (small glands) under the arm or near the collarbone"],
  ["ibc", "The breast became red, swollen and warm over a few weeks, across a large part of it"],
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
    out.push(`<div class="advice act"><h3>Please see a doctor in the next few days, not weeks.</h3>
      <p>A breast that turns red, swollen and warm over a few weeks is most often an infection. But these are also the usual signs of
      <b>inflammatory breast cancer</b>, a rare kind that grows fast and often has no lump. If you were treated for an infection and it is not
      getting better, go back and ask about breast imaging.</p><p class="src">${src("acsIbc")}</p></div>`);
  }
  if (changes.length) {
    out.push(`<div class="advice act"><h3>Please book a visit with a doctor soon. Do not wait for your next routine screening.</h3>
      <p>You ticked ${changes.length === 1 ? "one change" : changes.length + " changes"} that the CDC and the American Cancer Society list as possible signs of breast cancer.
      Most breast changes turn out <b>not</b> to be cancer. Still, each one should be checked, even if your last mammogram was normal.</p>
      ${s.has("lump") && age >= 30 ? `<p>In the UK, NICE guidance says that adults aged 30 and over with a breast lump that has no clear cause should be sent for fast cancer checks, with an answer within 28 days.</p>` : ""}
      <p class="src">${src("cdcSigns")}; ${src("acsSigns")}${s.has("lump") && age >= 30 ? "; " + link(NICE) : ""}</p></div>`);
  }
  if (s.has("pain") && !changes.length && !s.has("ibc")) {
    const fam = f("p-fam1") || f("p-fam2") || f("p-ovarian");
    out.push(`<div class="advice watch"><h3>${fam ? "Mention this pain to a doctor." : "Breast pain by itself is not usually a sign of cancer."}</h3>
      <p>Breast pain is very common and is often linked to hormones. See a doctor if it does not go away, stays in one spot, or comes with any of the changes above.
      ${fam ? "Because breast or ovarian cancer runs in your family, the NHS advises seeing a doctor about breast pain." : ""}</p>
      <p class="src">${link(NHS)}</p></div>`);
  }
  if (!s.size) {
    out.push(`<div class="advice ok"><h3>You have not ticked anything.</h3>
      <p>This tool cannot tell you that everything is fine. It only reacts to what you tick. If something about your breasts worries you, see a doctor even if it is not on this list.
      It also helps to know how your breasts normally look and feel, so you can spot a change.</p>
      <p class="src">${src("cdcSigns")}</p></div>`);
  }

  // ---- screening
  const highRisk = f("p-brca") || f("p-rad");
  const famAny = f("p-fam1") || f("p-fam2") || f("p-ovarian") || f("p-young") || f("p-ashk");
  let screen;
  if (!female) {
    screen = `<h3>Routine screening is not advised for men</h3><p>Men can get breast cancer too (about 1 in 100 breast cancers), so any lump or nipple change should be checked.
      Men whose families carry BRCA gene changes should ask about talking to a genetic counselor.</p><p class="src">${link({ label: "CDC: Breast cancer in men", url: "https://www.cdc.gov/breast-cancer/about/men.html" })}</p>`;
  } else if (highRisk) {
    screen = `<h3>You may need a high-risk screening plan.</h3>
      <p>The main U.S. screening advice is for people at <b>average</b> risk. For people with a BRCA or similar gene change, or who had chest radiation between ages 10 and 30,
      the American Cancer Society recommends a <b>yearly MRI and mammogram, usually starting at age 30</b>. Ask your doctor or a genetics clinic to help you make a plan.</p>
      <p class="src">${link(ACS_SCREEN)}</p>`;
  } else if (age < 40) {
    screen = `<h3>Routine mammograms usually start at 40.</h3><p>For women at average risk, the U.S. Preventive Services Task Force recommends a mammogram every 2 years from age 40 to 74.
      ${famAny ? "With a family history, talk to your doctor before you turn 40 about whether you need to start earlier." : "Until then, get to know what is normal for your breasts."}</p>
      <p class="src">${src("uspstf")}</p>`;
  } else if (age <= 74) {
    screen = `<h3>Recommended: a screening mammogram every 2 years.</h3>
      <p>The U.S. Preventive Services Task Force (April 2024) recommends <b>a mammogram every 2 years for women aged 40 to 74</b>. If yours is due, it is a good time to book it.</p>
      <p class="src">${src("uspstf")}</p>`;
  } else {
    screen = `<h3>At 75 and over, decide together with your doctor.</h3><p>The task force said there is not enough evidence to say for or against screening after age 74.
      Your health and what matters to you count most.</p><p class="src">${src("uspstf")}</p>`;
  }
  out.push(`<div class="advice info">${screen}</div>`);

  if (famAny) {
    out.push(`<div class="advice info"><h3>Your family history matters. Ask your doctor for a family risk check.</h3>
      <p>The U.S. Preventive Services Task Force advises that women who have had breast, ovarian, fallopian tube or peritoneal cancer, who have relatives with these cancers, or whose ancestry is linked to BRCA1 or BRCA2
      gene changes (such as Ashkenazi Jewish) answer a short set of risk questions. If the answers point to higher risk, the next step is talking to a genetic counselor.
      ${f("p-fam1") ? "Having a mother, sister or daughter with breast cancer about doubles a woman’s chance of getting it." : ""}
      ${f("p-fam2") && !f("p-fam1") ? "A grandmother’s or aunt’s breast cancer counts too, especially if it was found at a young age or if several relatives on the same side had it." : ""}
      Most women with a family history never get breast cancer. It is a reason to make a plan with your doctor.</p>
      <p class="src">${src("uspstfBrca")}; ${src("acsRisk")}</p></div>`);
  }
  $("#check-out").innerHTML = out.join("");
}
