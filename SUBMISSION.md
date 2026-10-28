# SecondLook: Devpost kit

## 1. Project abstract (under 300 words)

> **SecondLook: breast imaging results, explained.**
>
> One in eight U.S. women will be diagnosed with breast cancer. Imaging reports are written for doctors, so many people spend the days between a callback and a biopsy searching words like "BI-RADS 4B" or "spiculated" alone. My grandmother's experience with breast cancer inspired this project.
>
> SecondLook helps people understand a result and get ready to talk with their doctor. Each part uses the tool that fits its job:
> (1) **Fixed rules** read a mammogram or ultrasound report and pull out the BI-RADS score, breast density, where the finding is, and what each of 70+ words means. Rules are predictable and testable.
> (2) **A language model** explains those findings in everyday words, answers follow-up questions, and writes questions for the doctor. It sits inside fixed safety notes and a reply guard, and the chat asks permission before anything leaves the browser.
> (3) **Our own image classifier** looks at breast ultrasound pictures. We built it on a pretrained, frozen EfficientNet-B0 and trained our own classification layer. We wrote the data preparation, duplicate and conflicting-image handling, and grouped testing, then converted it to ONNX so it runs in the browser with a highlight map.
> (4) A **report sanity check** looks for values that cannot be right and statements that disagree, and shows a warning box without ever choosing which statement is correct.
> (5) A symptom checker and a biopsy lab add education.
>
> We were careful about honesty. The ultrasound model finds about 75 of 100 cancer images in our own test and is labeled a research demo. Duplicate images can inflate results, so we kept copies together, and we still say real accuracy on new patients may be lower. We wrote 135 test conversations for the assistant and report every run, including failures. The latest live run passed 129 of 135. No clinician has reviewed the project yet.

## 2. Demo script (about 3 minutes)

Use only the built-in sample reports. They are made up. Each step is tagged with the technology behind it.

| Time | On screen | Say | Technology |
|---|---|---|---|
| 0:00 to 0:15 | Home page, point at "Words you might see" | "After a mammogram, a doctor writes a report for other doctors. My grandmother went through the waiting and the confusion. SecondLook explains it in plain words." | None, just the story |
| 0:15 to 0:50 | Read my report. Click **Sample: Ultrasound, biopsy recommended**. Hover over "spiculated". Scroll past the BI-RADS card and the location diagram. | "The page reads the report with fixed rules. It finds the BI-RADS score, the density, where the finding is, and explains each word. Same report in, same answer out. Nothing here is made up, and nothing leaves my browser." | **Fixed rules** |
| 0:50 to 1:10 | Scroll to the chat. Point at the privacy box. Click **I understand. Start chatting.** | "The chat is the only part that sends text out. It tells me exactly what goes where, to OpenAI through our server, and waits for me to agree. The server refuses anything that skipped this step." | **Privacy gate** |
| 1:10 to 1:40 | Click **What can this report not tell me?** Then type **Does this mean I have cancer?** | "Now a language model explains the findings. It knows my report. It says what the report says and what is general knowledge. When I ask if I have cancer, it will not say yes or no. It says a biopsy is how doctors find out." | **Language model**, using what the rules found |
| 1:40 to 2:00 | Click **Ask the assistant to tailor these** | "It writes questions to bring to the appointment, based on this report." | **Language model** |
| 1:55 to 2:00 | Optional: paste a made-up report with a clock position of 14 | "If a report has a value that cannot be right, SecondLook shows a warning above the findings. It does not say who is right. It asks me to double check my copy and ask the imaging team." | **Report sanity check (fixed rules)** |
| 2:00 to 2:15 | Type **I just found a new lump near my armpit**. Point at the yellow note. | "If I describe a worrying symptom, a fixed message tells me to get checked soon. That message does not depend on the AI." | **Fixed safety rules** |
| 2:15 to 2:50 | Ultrasound AI. Click a malignant sample. Point at the percentages, the highlight map, the research-demo label, and "How well does this model work?" | "This is a different job: looking at pixels. We built this model on a frozen, pretrained EfficientNet-B0 and trained our own classification layer. We cleaned out copied images, tested with copies kept together, and converted it to run in the browser. It finds about 3 in 4 cancer images and misses about 1 in 4, so it is a research demo, not a medical test. The highlight map shows where the model looked, not where a cancer is." | **Our image classifier** |
| 2:50 to 3:00 | How it works page | "Rules read, a language model explains, and an image model looks. Each one does the job it is good at. No doctor has reviewed this yet, and it never replaces one." | |

Recording tips: 1280 by 800 window, 100 percent zoom, page already loaded so the model is warm, calm pace. Do a dry run first. Replies vary a little each time, so read the reply before you speak about it.

## 3. Five-minute pitch

1. **Hook (0:30).** The grandmother story, then "one in eight".
2. **Problem (0:40).** Reports are written for radiologists. People wait days and search jargon alone.
3. **Walkthrough (1:30).** Follow the demo script above.
4. **Why rules, a language model and an image model (0:45).** Rules for what must be predictable. A language model for explaining and conversation. An image model for pixels. We did not add AI where plain rules are safer.
5. **Our technical work on the ultrasound model (1:00).**
   - Pretrained EfficientNet-B0, frozen. We trained a final layer: 3 x 1,280 weights and 3 offsets.
   - Data pipeline: 780 images, 312 had near-copies, 22 images with conflicting labels removed, leaving 758.
   - Testing: 5 folds where groups of copies never cross between training and testing. Results: AUC 0.90, finds 75 of 100 cancer images, clears 88 of 100 non-cancer images.
   - Converted to ONNX (matches the original to 2.5 in a million) and runs in the browser (matches Python to within 0.015).
   - Honest limits: one hospital, no outside test, same-patient images may still be split.
6. **Trust and safety (0:30).** Privacy gate. Fixed safety notes. A reply guard. A report sanity check. 135 test conversations with every run recorded, including the failure where the model said "nothing to worry about" and how we fixed it.
7. **Close (0:25).** "SecondLook does not replace a doctor. It helps people walk into the room with better questions."

## 4. Likely questions

**Did you train the image model?**
We trained the final classification layer and built everything around it. The EfficientNet-B0 underneath is pretrained and frozen. We did not train it from scratch and we did not fine-tune it. We chose this because the dataset is small (758 usable images), it trains in minutes on a laptop, and a linear layer lets us draw an exact highlight map in the browser.

**Is the assistant fine-tuned?**
No. It is a general model from OpenAI with instructions we wrote, plus fixed safety checks in code. We have 135 test conversations to check it, but we did not train anything on them. The test score measures wording and safety rules. It is not medical accuracy.

**Why use rules for the report instead of AI?**
Rules give the same answer every time and are easy to test, which is what we want for pulling the BI-RADS score and findings out of a report. The language model then explains those findings. Each does the job it is good at.

**Why are your ultrasound numbers lower than papers?**
Many papers let copies of the same image land in both the practice and test sets. We kept copies together. BUSI also does not say which images belong to the same woman, so our numbers may still be a bit high.

**What do the numbers mean?**
An AUC of 0.90 means that if you pick one cancer image and one non-cancer image, the model scores the cancer one higher about 90 times out of 100. It finds about 3 in 4 cancer images. These come from one hospital's images and do not show how it would do in a clinic.

**Could the highlight map mislead?**
Yes, so we label it. It shows where the model looked, not where a cancer is. It is also scaled so the strongest spot is always the brightest, so it always shows a hot spot, even when the model is unsure.

**What about privacy?**
The explainer, the ultrasound demo, the symptom check and the lab run in the browser. Only the chat sends text, to our server and then to OpenAI. The chat is locked until the person reads and accepts a notice about this, and the server refuses requests that skipped it. We do not store the messages. OpenAI may keep them briefly under its own rules.

**What does the sanity check do, and what can it miss?**
It checks a report with fixed rules and flags clock positions that do not exist, odd sizes, conflicting BI-RADS numbers, contradictory descriptions and left and right mismatches. It never says which statement is right. It uses fixed rules, so it can miss things. It cannot catch every contradiction. Two descriptions of one lesion only count as a conflict when the side, the clock position or a back-reference such as "the mass" lets us tell they are about the same lesion. Small unit slips, such as 1.2 mm where 1.2 cm was meant, are missed. Clock positions written as words, such as "fourteen o'clock", are not detected. We have not tested it with a real screen reader.

**Is it safe? Has a doctor checked it?**
No doctor has reviewed it yet. It never says whether someone has cancer and never says "don't worry". Urgent words get a fixed message. It can still be wrong, and every page says it is not a medical device.
