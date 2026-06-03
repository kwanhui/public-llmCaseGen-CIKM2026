import type { DisciplinePack } from "./types";

export const SOCIAL_WORK: DisciplinePack = {
  id: "social_work",
  label: "Social Work",
  blurb:
    "Values-based, relational reasoning under ethical complexity. Cases turn on stakeholder mapping, risk and needs assessment, and culturally-sensitive intervention design.",
  systemPrompt: `You are an experienced social-work instructor authoring a teaching case for a professional social-work programme (BSW or MSW level). Produce a case that:
- Centres on a realistic professional decision facing a frontline social worker, supervisor, or programme coordinator.
- Has a values-based and relational core: ethical complexity, multiple stakeholders with competing interests, and culturally-grounded judgement are implicit in the scenario.
- Names a fictional client/family (use de-identified composite scenarios; never reference real individuals) but situates the case in a credible practice setting (eldercare, child protection, mental-health, community development, school social work, etc.) and country/region.
- Provides enough relational and contextual detail (presenting concerns, family system, cultural and religious considerations, prior interventions, agency/legal mandates) for a learner to reason from, without reducing the client to a symptom list.
- Embeds the instructor-supplied learning objective and must-cover concepts naturally — these often include practice frameworks (e.g. ecological systems, strengths-based, trauma-informed) or ethical principles.
- Calibrates difficulty: novice cases isolate one practice decision and provide most context; intermediate cases require navigating competing stakeholder views; advanced cases involve genuine ethical dilemmas with no clean answer.

Required structured output (Markdown allowed in fields):
- scenario: 350–600 words. Sets up the client/family, the presenting concern, the agency context, the relational dynamics, and the specific decision facing the practitioner.
- discussionQuestions: 4–6 open-ended questions, ordered from understanding to action.
- modelAnswers: matched 1:1. Each is 60–120 words, references practice frameworks where relevant, and treats the client as a person (not a case file).
- rubric: a teaching rubric with 4 weighted criteria (case understanding, ethical reasoning, intervention quality, cultural/relational sensitivity), each with a single-sentence "what excellent looks like".

Appropriateness and safety: this is a teaching artifact about vulnerable people. Do not depict graphic abuse, self-harm, or violence in explicit detail; reference such concerns at the level a case file would, not a re-enactment. Do not draw on cultural, ethnic, religious, gender, or disability stereotypes; cultural context must be specific and respectful, not a caricature. If the requested objective would require harmful or distressing content to teach, write the most restrained version that still meets it. Every case is reviewed and approved by the instructor before any student sees it, but write as if it will not be caught.

Personalisation: adapt the practice setting, the client population, and the cultural context to the target learner profile. Never reduce the client to a problem; always include strengths and protective factors. Stay within the discipline's vocabulary.`,
  styleNotes: [
    "Refer to the client by a name (composite, de-identified) — not 'the client' throughout.",
    "Include strengths and protective factors alongside risks. A case that lists only deficits is a poor case.",
    "Cultural, religious, and linguistic context should constrain the intervention, not be window-dressing.",
    "Avoid pathologising language. 'Struggling with' is not the same as 'has'.",
    "Discussion questions should probe values and reasoning, not just protocol recall.",
    "Rubric criteria should reward specific practice moves, not generic empathy claims.",
  ],
  vocabulary: [
    "ecological systems",
    "strengths-based",
    "person-in-environment",
    "trauma-informed",
    "psychosocial assessment",
    "genogram",
    "ecomap",
    "presenting concern",
    "protective factors",
    "risk factors",
    "self-determination",
    "informed consent",
    "mandatory reporting",
    "boundary",
    "supervision",
    "reflective practice",
  ],
  difficultyHints: {
    novice:
      "Single practice decision. Stakeholder views are aligned. The learner applies one framework correctly. Limit ethical ambiguity.",
    intermediate:
      "Stakeholders disagree (e.g. client wants one thing, family another, agency mandates a third). The learner must surface the tension and propose a path that respects self-determination.",
    advanced:
      "Genuine ethical dilemma — competing principles (e.g. autonomy vs. protection) cannot both be honoured. The learner must reason about which value is being subordinated and why.",
  },
  fewShots: [
    {
      title: "Madam Tan — eldercare placement and family conflict",
      scenario:
        "Madam Tan, 78, lives alone in a one-room HDB flat in Singapore. She was admitted to hospital after a fall and her geriatrician has flagged moderate cognitive impairment. Her three adult children disagree sharply: the eldest, Mei Ling (52, in Singapore), wants her admitted to a nursing home immediately; the middle son, Wei Han (49, in Australia), insists she should stay home with a live-in helper; the youngest, Pei Ling (44, in Singapore), wants to take her in but works full-time and has two teenage children. Madam Tan herself, when lucid, says she wants to 'go home'. You are the medical social worker assigned to coordinate discharge. The discharge planner needs a recommendation in 5 working days.",
      discussionQuestions: [
        "What is Madam Tan's own voice in this decision, and how does her capacity affect the weight you give it?",
        "Map the family system: where are the alliances, the silences, and the unstated obligations?",
        "What practice principles are in tension here, and which would you give priority to and why?",
        "Sketch a discharge plan. What does week 1 look like, and what would prompt you to revise it?",
      ],
      rubric:
        "Client voice (25%): centres Madam Tan's stated wishes and reasons for them, accounting for capacity. Family-system reading (25%): reads alliances and unstated dynamics, not just stated positions. Ethical reasoning (25%): names the values in tension explicitly. Intervention realism (25%): proposes a plan with concrete first steps and revision triggers.",
    },
    {
      title: "Aaron, 14 — disclosure of self-harm in a school setting",
      scenario:
        "Aaron is a 14-year-old student at a secondary school where you are the school social worker. During a wellness check-in, he discloses that he has been cutting his upper arms over the past three weeks. He asks you not to tell his parents — his father is 'very strict' and his mother is recovering from a recent hospitalisation. He has not expressed suicidal intent, has no plan, and says cutting helps him 'feel something'. School policy requires parental notification for any self-harm disclosure. Aaron has trusted you to come forward. You have 24 hours before the next scheduled wellness check-in.",
      discussionQuestions: [
        "What is the safety picture, separate from the policy question? What would you assess in the next 30 minutes?",
        "How does mandatory reporting interact with Aaron's trust and his self-determination as a minor?",
        "What are your options between 'tell the parents fully' and 'honour his confidence'? Are there middle paths?",
        "How would you support Aaron through whatever you decide, including the conversation he most fears?",
      ],
      rubric:
        "Safety assessment (30%): distinguishes risk indicators from protocol indicators. Ethical analysis (25%): treats the trust/disclosure tension explicitly, not via policy alone. Intervention quality (25%): proposes a graduated response with the young person's voice in it. Relational sensitivity (20%): centres how Aaron will experience the next conversation.",
    },
  ],
  rubricTemplate: `Case understanding (X%) — what excellent looks like.
Ethical reasoning (X%) — what excellent looks like.
Intervention quality (X%) — what excellent looks like.
Cultural/relational sensitivity (X%) — what excellent looks like.`,
  defaultPhases: [
    {
      id: "sw-understanding",
      order: 0,
      label: "Case understanding",
      studentTitle: "1. Case understanding",
      studentPrompt:
        "Read the case and write a brief **psychosocial summary** of the client/family in your own words. Distinguish presenting concerns from underlying needs. List the clarifying questions you'd want answered before proceeding.",
      activities: ["clarifying_questions", "notes"],
      disciplineHint:
        "Centre the client as a person, not a problem. Strengths and protective factors belong in the summary too, not as an afterthought.",
    },
    {
      id: "sw-mapping",
      order: 1,
      label: "Ecological & stakeholder mapping",
      studentTitle: "2. Ecological & stakeholder mapping",
      studentPrompt:
        "Map the **person-in-environment**: who are the stakeholders (family, agency, community, legal/cultural systems), what are their relationships, and where are the alliances or tensions? Note any cultural, religious, or linguistic factors that shape the field.",
      activities: ["clarifying_questions", "notes"],
      disciplineHint:
        "Sketch a quick ecomap if it helps. Watch for stakeholders whose voice is missing from the case as written.",
    },
    {
      id: "sw-assessment",
      order: 2,
      label: "Risk & needs assessment",
      studentTitle: "3. Risk & needs assessment",
      studentPrompt:
        "Conduct a structured assessment: what are the **risk factors**, the **protective factors**, the **immediate safety concerns** (if any), and the **needs** (practical, emotional, relational, systemic)? What practice frameworks apply here?",
      activities: ["notes"],
      disciplineHint:
        "Risk and need are not the same. A case can be high-need and low-risk (or the reverse). Distinguish them explicitly.",
    },
    {
      id: "sw-intervention",
      order: 3,
      label: "Intervention planning",
      studentTitle: "4. Intervention planning",
      studentPrompt:
        "Propose a **graduated intervention plan**. What would you do first, in what setting, with whose involvement? What are you explicitly *not* doing yet, and why? How does the plan honour the client's self-determination while addressing legitimate concerns?",
      activities: ["notes"],
      disciplineHint:
        "An intervention is a sequence, not a single act. Name the first conversation specifically.",
    },
    {
      id: "sw-reflection",
      order: 4,
      label: "Ethical reflection",
      studentTitle: "5. Ethical reflection",
      studentPrompt:
        "Reflect on the **ethical dimensions** of your plan. Which professional values were in tension (e.g. autonomy vs. protection, confidentiality vs. mandatory reporting)? Which value did you ultimately privilege and why? What would you bring to supervision about this case?",
      activities: ["notes", "answer_attempt"],
      disciplineHint:
        "Naming what you subordinated is more honest than claiming you balanced everything. Supervision exists for exactly this kind of reasoning.",
    },
  ],
};
