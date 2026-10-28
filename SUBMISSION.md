# SecondLook: Devpost kit

## 1. Project abstract (under 300 words)

> **SecondLook: breast imaging results, explained.**
>
> One in eight U.S. women will be diagnosed with breast cancer. Imaging reports are written for doctors, so many people spend the days between a callback and a biopsy searching words like "BI-RADS 4B" or "spiculated" alone. My grandmother's experience with breast cancer inspired this project.
>
> SecondLook helps people understand a result and get ready to talk with their doctor. Four parts work together:
> (1) A report explainer reads a mammogram or ultrasound report and shows what the BI-RADS number means, breast density, where the finding is, and what each of 72 words means.
> (2) A chat assistant sits under the report and answers follow-up questions using the decoded report as context. It keeps "your report says" apart from general information, admits what it cannot know, never says whether someone has cancer, and shows a fixed safety message for urgent symptoms.
> (3) A symptom and screening checker follows CDC, American Cancer Society, NHS and USPSTF advice.
> (4) A research demo looks at a breast ultrasound in the browser and shows a highlight map. It uses EfficientNet-B0, which other researchers built, plus a small final step we trained on the public BUSI images.
>
> We tried hard to be honest. We removed copied images from BUSI and tested with copies kept together, and we still say the real accuracy on new patients may be lower. The demo finds about 75 of 100 cancer images in our own test, and it is not a medical test. We wrote 119 test conversations to check the assistant's wording and safety, and we report every run, including failures.
>
> SecondLook serves people waiting for results.

## 2. Demo video script (about 2:45)

Use only the built-in sample reports, which are made up.

| Time | On screen | Voice-over |
|---|---|---|
| 0:00 to 0:15 | Home page | "One in eight women will face breast cancer. The hardest part is often waiting and not understanding the report. My grandmother went through that." |
| 0:15 to 1:00 | Read my report. Click the "Ultrasound, biopsy recommended" sample. Hover over "spiculated". | "Paste a report. SecondLook shows what BI-RADS 4B means and what usually happens next. It shows where the finding is. Every word is explained, and the explaining happens in your browser." |
| 1:00 to 1:45 | Chat under the report. Click "What can this report not tell me?". Then type "Does this mean I have cancer?". | "Now ask a question. The assistant knows your report. It says what the report says and what is general knowledge. When I ask if I have cancer, it says it cannot tell, and that a biopsy is how doctors find out." |
| 1:45 to 2:05 | Click "Ask the assistant to tailor these" or the appointment prompt | "It can write questions to bring to the appointment." |
| 2:05 to 2:20 | Type "I just found a new lump". Show the yellow safety note. | "If someone describes a worrying symptom, a fixed message tells them to get checked soon. That message does not depend on the AI." |
| 2:20 to 2:40 | Ultrasound AI. Click a sample. Show "How well does this model work?" | "This is a research demo. It runs in the browser. It misses about 1 in 4 cancers in our test, so we say it is not a medical test." |
| 2:40 to 2:50 | How it works page | "Everything is explained here, including what we built and what we did not." |

Recording tips: 1280 by 800 window, 100 percent zoom, page already loaded so the model is warm, calm pace.

## 3. Five-minute pitch

1. **Hook (0:30).** The grandmother story, then "one in eight".
2. **Problem (0:40).** Reports are written for radiologists. People wait days and search jargon alone.
3. **Walkthrough (1:30).** Report, then chat, then the symptom check.
4. **How we made it trustworthy (1:00).**
   - Report explainer uses fixed, sourced rules.
   - The chat has a fixed safety layer and a reply guard that stops false reassurance and diagnosis.
   - 119 test conversations. Show the failures we found and fixed, such as the assistant saying "nothing to worry about".
   - Ultrasound demo: cleaned data, copies kept together, honest limits.
5. **What is ours and what is not (0:30).** We did not train the language model or the image backbone. We built the report explainer, the instructions and safety layer, the test set, the cleanup and testing of BUSI, the in-browser version, and the interface.
6. **Impact and next steps (0:40).** Next: have clinicians review the wording, test the report reader on real de-identified reports, test the ultrasound model on outside data, and add more languages. We have no user data yet and make no claims about impact.
7. **Close (0:20).** "SecondLook does not replace a doctor. It helps people walk into the room with better questions."

## 4. Likely questions

**Is the assistant fine-tuned?**
No. It is a general model from OpenAI with instructions we wrote. We have a set of 119 test conversations to check it, but we did not train anything on them.

**Why are your ultrasound numbers lower than papers?**
Many papers let copies of the same image land in both the practice and test sets. We kept copies together. BUSI also does not say which images belong to the same woman, so our numbers may still be a bit high.

**Could the highlight map mislead?**
It shows where the model looked. It does not show where a cancer is. The app says this next to every map.

**What about privacy?**
The explainer, the ultrasound demo, the symptom check and the lab run in the browser. Only the chat sends text, to our server and then to OpenAI. We do not store it. OpenAI may keep it briefly under its own rules. The app says this before and after you use the chat.

**Is it safe?**
It never says whether someone has cancer and never says "don't worry". Urgent words get a fixed message. It can still be wrong, no clinician has reviewed it yet, and every page says it is not a medical device.
