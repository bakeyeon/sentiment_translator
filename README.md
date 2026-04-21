
# Sentiment Translator 
Vibe coded a prototype based on my previous papers on the topic of sentiments and emojis.

- Paper 1: Modalpartikeln': Can Sentiments Survive Translation with Emojis? (https://github.com/bakeyeon/Modalparticles_Emojis)
- Paper 2: How Much Sentiment Can Be Carried by Modal Particles? (https://github.com/bakeyeon/modalparticles_sentiment_analysis)
- Video Overview of 2 Papers: https://youtu.be/dYcz4MZNst4

## Limitations
- Subjectivity of Survey Data: As the study relies on surveys of proficient language users, the data is inherently subject to individual interpretation and personal perception of emotional nuances.
- Small Sample Size and Robustness: With $N=35$ for Survey 1 and $N=112$ for Survey 2, the relatively small sample sizes may limit the statistical robustness and the generalizability of the findings to a broader population.
- Cross-Cultural and Linguistic Variables: Emotional perception is deeply tied to cultural background and language proficiency. These factors influence how both modal particles and emojis are interpreted, potentially limiting the universal applicability of the results.
- Contextual Ambiguity and Polysemy: Certain particles, such as ja or schon, can convey opposing sentiments (e.g., friendliness vs. annoyance) depending on the context. Assigning a fixed sentiment score to these particles involves a degree of arbitrary simplification of their pragmatic complexity.

## Key Functions
- 📊 Nuance Analysis: It analyzes the emotional tone of both the original and translated text.
- 🙂 At-a-glance Emojis: It assigns an emoji to each text, giving you an instant feel for the underlying sentiment.
- 🗺️ Clickable Emotion Map: Click the emoji to see it expand, showing its position on a visual gradient map to gauge the emotional tone.

Vibe-coded with Google AI Studio.

## Run Locally
**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>
