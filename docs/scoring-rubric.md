# Scoring rubric and calibration (v2.0.0)

From v2.0.0, every Gemini scoring prompt in Sentiment Translator shares one rubric with anchor sentences. The model call uses a fixed seed (`2026`), and the server rounds the scores it returns. This note records how the anchor values were chosen and checked.

The three axes follow SFF (Sentiment-Formality-Friendliness):

| Axis | Range | Map position |
|---|---|---|
| Sentiment | −1.0 to +1.0 | Colour, from red through yellow to green |
| Formality | 0 to 100 | Horizontal: further right is more formal |
| Friendliness | 0 to 100 | Vertical: higher is friendlier |

Up to v1, the vertical axis was *intimacy*. v2.0.0 replaces it with *friendliness*, so the app matches SFF.

## The rubric

The rubric text is the `RUBRIC` constant in [`server.ts`](../server.ts); both `/api/gemini/sentiment` and `/api/gemini/translate` use it.

| Axis | Anchor sentences |
|---|---|
| Sentiment | −0.9 *I hate this.* · −0.7 *That's disappointing.* · 0.0 *The meeting is at 3.* · 0.5 *Sounds good.* · 0.8 *Thanks so much!* · 0.95 *I love you, mom.* |
| Formality | 0 *ㅇㅋ* · 10 *Komm vorbei!* · 45 *Could you come by?* · 55 *Kommen Sie bitte vorbei.* · 70 *Würden Sie bitte vorbeikommen?* · 85 *Wir bitten Sie, bei uns vorbeizukommen.* / *참석해 주시기 바랍니다.* |
| Friendliness | 15 *Your request has been received. Please wait.* · 35 *Nice to meet you.* · 50 *Hey, want to grab lunch?* · 70 *Komm vorbei!* · 95 *I love you, mom.* |

The rubric also gives these rules:
- A standard polite form (German *Sie*, Korean *-요*, Japanese *です/ます*) is the everyday polite default, around 50–60. It is not high formality by itself. Scores of 75 and above are for honorific, official or institutional register.
- Casual grammar alone does not make a sentence friendly.
- Softening particles (Thai *นะ*, Japanese *ね*, German *doch / mal*, a soft Korean *-요*) raise friendliness by about 5–15. They do not flip the sign of sentiment.
- Everyday questions, greetings and softened check-ins are neutral to slightly positive (0.0 to 0.2) unless there are explicit negative cues.
- Sentiment is rounded to 0.05; formality and friendliness are rounded to 5.

## 1. Before the rubric: what the model produced

The anchor sentences were first scored with the v1 prompt, which had score bands but no anchors and no seed. Columns are sentiment / formality / intimacy (v1 axis). Multiple runs are separated by slashes. Flash-Lite ran each sentence up to three times; some runs are missing because of the free-tier rate limit.

| Sentence | gemini-3.5-flash-lite | gemini-4-hydrogen |
|---|---|---|
| I hate this. | −0.9/−0.9/−0.85 · 40/40/25 · 20 | −0.9 · 40 · 20 |
| That's disappointing. | −0.8/−0.7/−0.8 · 45/40/40 · 35 | – |
| The meeting is at 3. | 0 · 50 · 35/35/20 | 0 · 52 · 25 |
| Sounds good. | 0.6 · 35 · 45 | – |
| Thanks so much! | 0.8/0.85/0.85 · 30/35/35 · 55/55/50 | – |
| ㅇㅋ | 0 · 0 · 50 | – |
| Komm vorbei! | 0.4/0.6/0.3 · 10 · 65/70/65 | – |
| Could you come by? | 0 · 48/45 · 45 | – |
| Kommen Sie bitte vorbei. | 0.1 · **90/75** · 35/40 | – |
| Würden Sie bitte vorbeikommen? | 0.1 · **90/75/80** · 35/40/40 | – |
| Wir bitten Sie, bei uns vorbeizukommen. | 0/0.05/0.2 · **90/75/85** · 20/35/35 | – |
| 참석해 주시기 바랍니다. | 0 · 85/100 · 40/30 | – |
| Your request has been received. Please wait. | 0 · 70 · 15 | – |
| Nice to meet you. | 0.7/0.8/0.8 · 50/50/60 · 40/40/35 | – |
| Hey, want to grab lunch? | 0.25 · 15 · 50/45/45 | – |
| I love you, mom. | 0.95/1 · 22.5/25 · 95 | – |

What this showed:
- **Formality was the least stable axis.** The same sentence moved by up to 15 points between runs.
- **German Sie was treated as high formality.** All three German polite levels landed at 75–90, so everyday *Sie* could not be told apart from institutional register. English *you* has no T/V distinction, which makes this an easy mistake.
- **On the two sentences tested, Flash-Lite and Hydrogen agreed closely.** Sentiment matched exactly; the other axes differed by 10 points or less. Hydrogen was mostly unavailable (503, high demand), so the rubric was calibrated on Flash-Lite as a proxy.

## 2. After the rubric (gemini-3.5-flash-lite, seed 2026, two runs)

Columns are sentiment / friendliness / formality. Where both runs succeeded, the two runs returned identical scores.

| Sentence | Run 1 | Run 2 |
|---|---|---|
| That's disappointing. | −0.7 / 30 / 45 | −0.7 / 30 / 45 |
| Sounds good. | 0.5 / 60 / 45 | 0.5 / 60 / 45 |
| Kommen Sie bitte vorbei. | 0.05 / 40 / **55** | 0.05 / 40 / 55 |
| Würden Sie bitte vorbeikommen? | 0.05 / 55 / **70** | – |
| Wir bitten Sie, bei uns vorbeizukommen. | 0.1 / 35 / **85** | – |
| Komm doch mal vorbei! | 0.25 / 70 / 10 | 0.25 / 70 / 10 |
| ไปไหนมานะ | 0.1 / 60 / 15 | – |
| ちょっと待ってね | 0.1 / 60 / 10 | – |
| 어디 갔다 왔어? | 0 / 50 / 10 | – |
| Hey, want to grab lunch? | 0.15 / 50 / 20 | 0.15 / 50 / 20 |

What this showed:
- The German politeness levels now separate: 55, then 70, then 85.
- Particle effects are visible. *ไปไหนมานะ* and *ちょっと待ってね* score friendliness 60, higher than the particle-less *어디 갔다 왔어?* at 50.

## 3. Cross-check with Claude

Claude (Opus) scored the anchors on its own judgement. Columns are sentiment / formality / friendliness. **Caveat:** Claude helped draft the rubric and had seen the Flash-Lite results, so this is a sanity check, not an independent rating.

| Sentence | Claude | Rubric anchor |
|---|---|---|
| I hate this. | −0.85 / 40 / 15 | sentiment −0.9 |
| That's disappointing. | −0.6 / 50 / 30 | sentiment −0.7 |
| Sounds good. | 0.45 / 35 / 55 | sentiment 0.5 |
| Thanks so much! | 0.8 / 35 / 70 | sentiment 0.8 |
| ㅇㅋ | 0.05 / 0 / 45 | formality 0 |
| Could you come by? | 0.05 / 50 / 45 | formality 45 |
| Kommen Sie bitte vorbei. | 0.1 / 55 / 35 | formality 55 |
| Würden Sie bitte vorbeikommen? | 0.1 / 65 / 40 | formality 70 |
| Wir bitten Sie, bei uns vorbeizukommen. | 0.1 / 80 / 30 | formality 85 |
| 참석해 주시기 바랍니다. | 0.05 / 85 / 20 | formality 85 |
| Your request has been received. Please wait. | 0 / 70 / 15 | friendliness 15 |
| Nice to meet you. | 0.6 / 55 / **50** | friendliness **35** |
| Hey, want to grab lunch? | 0.3 / 10 / **65** | friendliness **50** |
| Komm vorbei! | 0.35 / 10 / 65 | formality 10, friendliness 70 |
| I love you, mom. | 0.95 / 15 / 95 | sentiment 0.95, friendliness 95 |

Agreement and disagreement:
- **Agreement:**
  - Sentiment is within about 0.1 everywhere.
  - Claude ranks the German politeness levels in the same order, with similar gaps (55 / 65 / 80).
  - The ends of each scale agree.
- **Disagreement, on friendliness for everyday friendly lines:** Claude rated *Nice to meet you.* and *Hey, want to grab lunch?* about 15 points higher. Claude was scoring the warmth of the wording alone. The rubric also weighs how close the speaker and listener actually are.

**Decision:** keep the rubric values. Scoring tone alone is a reasonable reading, but friendliness in SFF should also reflect the relationship the utterance implies. A first-meeting greeting is warm but not close.

## Limitations

- The anchors were calibrated on **gemini-3.5-flash-lite**. The app runs on **gemini-4-hydrogen**, which was mostly unavailable (503) during calibration. The rubric gives the model reference points, but Hydrogen's exact numbers may still differ.
- The seed is best effort. Gemini does not guarantee identical output for the same seed, and a model update can change scores.
- The sample is small: 16 anchor sentences, at most three runs each.
- The map is a prototype visualisation of SFF, not a validated measurement instrument. For the framework itself, see [The Grue Divide: When Cognitive Accuracy Doesn't Predict Affective Alignment](https://aclanthology.org/2026.pandora-1.2/).

## Reproducing

```bash
# score anchors on any Gemini model with the current rubric (reads the rubric from server.ts)
node demo/compare_model.mjs gemini-3.5-flash-lite "Kommen Sie bitte vorbei." "Komm doch mal vorbei!"

# run the whole app on another model
GEMINI_MODEL=gemini-3.5-flash-lite npm run dev
```
