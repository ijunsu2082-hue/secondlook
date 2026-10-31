# SecondLook: our Devpost journal

Hi, we're David Lee and Ajay Sriram Sankar. We built SecondLook for Code the Cure Hacks 2026. This file is everything we'd want a judge to know, written the way we'd explain it to a friend. It has the abstract, our demo script, our pitch, and the questions we expect.

One honest note up front. We used an AI coding assistant (Claude) while building this, for editing and checking code, tests and docs. We decided what to build and how it should behave, and we checked the results.

## 1. Project abstract (under 300 words)

This is the text we're pasting into Devpost.

> **SecondLook: breast imaging results, explained.**
>
> One in eight U.S. women will be diagnosed with breast cancer. Imaging reports are written for doctors, so many people spend the days between a callback and a biopsy searching words like "BI-RADS 4B" or "spiculated" alone. A grandmother's experience with breast cancer inspired this project.
>
> SecondLook helps people understand a result and get ready to talk with their doctor. Each part uses the tool that fits its job:
> (1) **Fixed rules** read a mammogram or ultrasound report and pull out the BI-RADS score, breast density, where the finding is, and what each of 70+ words means. Rules are predictable and testable.
> (2) **A language model** explains those findings in everyday words, answers follow-up questions, and writes questions for the doctor. It sits inside fixed safety notes and a reply guard, and the chat asks permission before anything leaves the browser.
> (3) **Our own image classifier** looks at breast ultrasound pictures. We built it on a pretrained, frozen EfficientNet-B0 and trained our own classification layer. We wrote the data preparation, duplicate and conflicting-image handling, and grouped testing, then converted it to ONNX so it runs in the browser with a highlight map.
> (4) A **report sanity check** looks for values that cannot be right and statements that disagree, and shows a warning box without ever choosing which statement is correct.
> (5) A symptom checker and a biopsy lab add education.
>
> We were careful about honesty. The ultrasound model finds about 75 of 100 cancer images in our own test and is labeled a research demo. Duplicate images can inflate results, so we kept copies together, and we still say real accuracy on new patients may be lower. We wrote 135 test conversations for the assistant and report every run, including failures. The latest live run passed 129 of 135. No clinician has reviewed the project yet.

## 2. Quick reference sheet for some basic questions

**Did you train the image model?**
We trained the final classification layer and built everything around it. The EfficientNet-B0 underneath is pretrained and frozen. We did not train it from scratch and we did not fine-tune it. We chose this because the dataset is small (758 usable images), it trains in minutes on a laptop, and a linear layer lets us draw an exact highlight map in the browser.

**Is the assistant fine-tuned?**
No. It is a general model from OpenAI with instructions we wrote, plus fixed safety checks in code. We have 135 test conversations to check it, but we did not train anything on them. The test score measures wording and safety rules. It is not medical accuracy.

**Why use rules for the report instead of AI?**
Rules give the same answer every time and are easy to test, which is what we want for pulling the BI-RADS score and findings out of a report. The language model then explains those findings. Each does the job it is good at.

**Why are your ultrasound numbers lower than papers?**
Many papers let copies of the same image land in both the practice and test sets. We kept copies together. BUSI (the public ultrasound image set we used) also does not say which images belong to the same woman, so our numbers may still be a bit high.

**What do the numbers mean?**
An AUC of 0.90 means that if you pick one cancer image and one non-cancer image, the model scores the cancer one higher about 90 times out of 100. It finds about 3 in 4 cancer images. These come from one hospital's images and do not show how it would do in a clinic.

**Could the highlight map mislead?**
Yes, so we label it. It shows where the model looked, not where a cancer is. It is also scaled so the strongest spot is always the brightest, so it always shows a hot spot, even when the model is unsure.

**What about privacy?**
The explainer, the ultrasound demo, the symptom check and the lab run in the browser. Only the chat sends text, to our server and then to OpenAI. The chat is locked until the person reads and accepts a notice about this, and the server refuses requests that skipped it. We do not store the messages. OpenAI may keep them briefly under its own rules.

**What does the sanity check do, and what can it miss?**
It checks a report with fixed rules and flags clock positions that do not exist, odd sizes, conflicting BI-RADS numbers, contradictory descriptions and left and right mismatches. It never says which statement is right. Because it uses fixed rules, it can miss things, and it cannot catch every contradiction.

- Two descriptions of one lesion only count as a conflict when the side, the clock position or a back-reference such as "the mass" lets us tell they are about the same lesion.
- Small unit slips, such as 1.2 mm where 1.2 cm was meant, are missed.
- Clock positions written as words, such as "fourteen o'clock", are not detected.
- We have not tested it with a real screen reader.

**Can it read a photo or PDF of a report?**
Yes. Photos are read with Tesseract.js and PDFs with PDF.js, both on the device, so nothing is uploaded. It shows the text so you can fix mistakes before anything is explained. We tried a clean picture, a text PDF, a scanned PDF and a blurry tilted photo. We have not tried real patient photos or the notorious doctor's handwriting.

**Is it safe? Has a doctor checked it?**
No doctor has reviewed it yet. It never says whether someone has cancer and never says "don't worry". Urgent words get a fixed message. It can still be wrong, and every page says it is not a medical device.