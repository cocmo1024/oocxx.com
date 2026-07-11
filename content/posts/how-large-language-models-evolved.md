---
title: "How Large Language Models Evolved"
description: "How next-token prediction became a general interface for knowledge, reasoning, and action."
date: 2026-07-11T09:30:00+08:00
draft: false
categories:
  - Artificial Intelligence
tags:
  - AI History
  - Large Language Models
  - Transformers
series:
  - AI Foundations
---

A large language model is easy to describe and surprisingly difficult to explain. At its core, it predicts the next token. Yet the systems built around that objective can write software, interpret images, search documents, call tools, and spend time working through a proof.

This did not happen because of one invention. Modern LLMs emerged when five lines of work converged: learned representations, scalable sequence models, broad pretraining, behavioral post-training, and inference systems that add memory, tools, and deliberate computation.

The history matters because each layer solves a different problem. Scale made models more capable, but scale alone did not make them useful assistants. Long context gave them more information, but not reliable knowledge. Reasoning training improved difficult problem solving, but introduced new tradeoffs in latency and cost.

The useful story, then, is not simply that models became larger. It is that next-token prediction gradually became the center of a much larger computing system.

## 2003-2016: Learning Representations Instead of Counting Phrases

Language modeling began as a probability problem: given some words, estimate what comes next. Classical n-gram models did this by counting short sequences in a corpus. They were practical, but brittle. A phrase never seen during training had little statistical support, even if it was similar to one the model knew.

The important shift was from discrete counts to continuous representations. In 2003, Bengio and collaborators proposed [a neural probabilistic language model](https://www.jmlr.org/papers/v3/bengio03a.html) that learned word vectors and a probability function together. Similar words could occupy nearby locations in a learned space, allowing evidence to be shared across related phrases. This was an early answer to the curse of dimensionality in language.

Recurrent neural networks and LSTMs then made it possible to process variable-length sequences. The 2014 [sequence-to-sequence model](https://arxiv.org/abs/1409.3215) used one LSTM to encode a sentence and another to decode its translation. It offered a general recipe: turn one sequence into another without hand-designed linguistic machinery.

But the original encoder had to compress an entire source sentence into one fixed-size vector. [Bahdanau attention](https://arxiv.org/abs/1409.0473) relaxed that bottleneck. Instead of relying on a single summary, the decoder learned to focus on different source positions for each output word.

Three foundations were now in place:

- words could be represented as learned vectors;
- neural networks could model sequences end to end;
- attention could select relevant information dynamically.

The remaining problem was computational. Recurrent models processed tokens in order, which made training difficult to parallelize. The architecture could learn long-range structure, but it was not yet an efficient engine for absorbing internet-scale text.

## 2017: The Transformer Made Scale Practical

The 2017 paper [*Attention Is All You Need*](https://arxiv.org/abs/1706.03762) removed recurrence from the main sequence model. Its Transformer architecture used self-attention to let every token build a context-dependent representation from other tokens in the sequence.

This changed the economics of training. During training, many token positions could be processed in parallel on accelerators. Multi-head attention let the network learn different relationships at once, while positional information preserved word order. Stacking attention and feed-forward blocks produced a regular architecture that scaled cleanly.

The original Transformer was an encoder-decoder built for translation, but its components soon split into three influential families:

- **encoder-only models** learned representations useful for understanding and classification;
- **decoder-only models** generated text autoregressively, one token after another;
- **encoder-decoder models** remained strong for tasks that transform one sequence into another.

The decoder-only branch would eventually dominate general-purpose LLMs. Its training objective was almost absurdly simple: predict the next token across a large collection of text. The architecture supplied the capacity; the data supplied a compressed record of language, code, facts, styles, and recurring patterns of reasoning.

## 2018-2020: Pretraining Became the Default Interface

Before this period, many NLP systems were trained separately for each task. The next breakthrough was to train one general model first, then adapt or prompt it for many tasks.

[ULMFiT](https://arxiv.org/abs/1801.06146) showed that a pretrained language model could be fine-tuned effectively for text classification. The first [GPT paper](https://cdn.openai.com/research-covers/language-unsupervised/language_understanding_paper.pdf) paired Transformer pretraining with supervised fine-tuning and transferred the same core model across different language-understanding tasks.

[BERT](https://arxiv.org/abs/1810.04805) took the encoder path. By masking tokens and conditioning on both left and right context, it produced representations that could be fine-tuned with a small task-specific layer. BERT rapidly became infrastructure for search, classification, extraction, and question answering.

GPT took the decoder path. A decoder trained to continue text had an unusual advantage: almost any task could be expressed as text in and text out. With GPT-2, this began to look like a general interface rather than a collection of separate classifiers. Translation, summarization, question answering, and imitation of a format could all be framed as continuation.

GPT-3 made the shift explicit. The 2020 paper [*Language Models are Few-Shot Learners*](https://arxiv.org/abs/2005.14165) described a 175-billion-parameter model that performed new tasks from instructions and examples placed directly in the prompt, without updating its weights. This was **in-context learning**: behavior could be specified at inference time through language.

The prompt became a lightweight programming surface. It was flexible, immediate, and accessible to people who did not train models. It was also unstable. Small wording changes could alter behavior, context windows were limited, and the model could produce fluent claims unsupported by evidence.

Still, a decisive transition had occurred. The model was no longer merely a component inside an NLP pipeline. The model itself had become the interface.

## 2020-2022: Scaling Became an Engineering Discipline

Why did larger models keep improving? The 2020 [scaling laws](https://arxiv.org/abs/2001.08361) study found that language-model loss followed predictable power-law relationships with model size, dataset size, and training compute. This gave research labs a planning tool: small experiments could forecast parts of a much larger training run.

But "more parameters" was an incomplete rule. The 2022 [Chinchilla](https://arxiv.org/abs/2203.15556) work showed that many large models were undertrained relative to their size. Under a fixed compute budget, model parameters and training tokens should grow together more closely. Its 70-billion-parameter model, trained on substantially more data, outperformed several much larger systems.

This reframed progress as an allocation problem:

- How much compute should go into parameters?
- How much data should each parameter see?
- How aggressively should the data be filtered and deduplicated?
- How much capability can be added without increasing inference cost proportionally?

Sparse mixture-of-experts architectures offered one answer to the last question. [Switch Transformers](https://arxiv.org/abs/2101.03961) routed each token through only a subset of model parameters. Total capacity could grow dramatically while active computation per token grew more slowly, though routing, communication, and training stability became harder.

Meanwhile, adaptation became cheaper. [LoRA](https://arxiv.org/abs/2106.09685) froze the base model and trained small low-rank updates instead of changing every parameter. This separated a reusable pretrained substrate from lightweight task or domain adaptations, an idea that later became central to the open-model ecosystem.

By 2022, pretraining was no longer just a research technique. It was an industrial process involving data pipelines, distributed optimization, numerical precision, hardware topology, evaluation, and increasingly careful decisions about what the model should learn.

## 2021-2023: A Language Model Became an Assistant

A pretrained model learns to continue text. A user, however, expects an assistant to interpret intent, follow instructions, decline unsafe requests, acknowledge uncertainty, and maintain a conversational role. Those are different objectives.

Instruction tuning began closing the gap. [FLAN](https://arxiv.org/abs/2109.01652) fine-tuned a model on many tasks expressed as natural-language instructions and improved zero-shot performance on unseen task types. The lesson was important: a diverse curriculum of instructions could teach a model the general pattern of following instructions.

[InstructGPT](https://arxiv.org/abs/2203.02155) added human preferences through a three-stage pipeline:

1. people demonstrated desirable answers;
2. people ranked model outputs, producing data for a reward model;
3. reinforcement learning adjusted the language model toward highly rated behavior while constraining it from drifting too far from the pretrained model.

In human evaluations, a 1.3-billion-parameter InstructGPT model was preferred to the original 175-billion-parameter GPT-3. Raw capability and useful behavior were now clearly separate dimensions.

The public launch of [ChatGPT](https://openai.com/index/chatgpt/) in November 2022 combined instruction-following post-training with a conversational interface and a feedback loop at unprecedented scale. The underlying ideas were not all new, but their integration changed how people understood language models. A model could be used iteratively: ask, inspect, correct, refine.

Post-training then became a major field of its own. [Constitutional AI](https://arxiv.org/abs/2212.08073) explored using written principles and AI-generated feedback to reduce reliance on direct human labels. [Direct Preference Optimization](https://arxiv.org/abs/2305.18290) showed that preference learning could be formulated with a simpler classification-style objective instead of a full reinforcement-learning pipeline.

This period established the modern model stack: broad pretraining creates capability; post-training shapes behavior.

## 2022-2024: Models Acquired Memory, Tools, and New Senses

Even a strong pretrained model has structural limits. Its weights are an imperfect, frozen form of memory. It cannot know a private document it has never seen, and updating a fact by retraining billions of parameters is impractical.

An earlier line of work, [retrieval-augmented generation](https://arxiv.org/abs/2005.11401), connected generation to an external document index. Instead of asking the model to produce every answer from parametric memory, a system could retrieve relevant passages and place them in context. This made knowledge easier to update and gave applications a path toward provenance, though retrieval quality and faithful use of evidence remained separate failure points.

Reasoning and action also began to merge. [Chain-of-thought prompting](https://arxiv.org/abs/2201.11903) showed that intermediate reasoning steps could improve performance on arithmetic, symbolic, and commonsense tasks in sufficiently large models. Those generated tokens acted as a temporary workspace.

[ReAct](https://arxiv.org/abs/2210.03629) interleaved reasoning with actions, allowing a model to query an external environment, observe the result, and update its plan. [Toolformer](https://arxiv.org/abs/2302.04761) explored teaching a model when and how to call APIs. The LLM was becoming a controller: language connected planning to calculators, search systems, code execution, databases, and software interfaces.

At the same time, model access broadened. [LLaMA](https://arxiv.org/abs/2302.13971) demonstrated that smaller models trained on more tokens could be highly competitive. [QLoRA](https://arxiv.org/abs/2305.14314) combined four-bit quantization with low-rank adapters, making it possible to fine-tune a 65-billion-parameter model on a single 48 GB GPU. Open weights, efficient tuning, quantization, and better local runtimes created an ecosystem outside the largest hosted APIs.

The input space expanded too. The [GPT-4 technical report](https://arxiv.org/abs/2303.08774) described a model accepting text and image inputs. The [Gemini 1.5 report](https://arxiv.org/abs/2403.05530) demonstrated multimodal retrieval and reasoning across contexts measured in millions of tokens. Text, images, audio, video, and long collections of documents were increasingly represented within one model interface.

These changes turned the standalone model into a system with four kinds of context:

- **parametric memory** in the weights;
- **working memory** in the current context window;
- **external memory** in retrieved documents and databases;
- **environment state** obtained through tools and actions.

Calling all of this "the model" became convenient but technically misleading. Much of the useful behavior now came from orchestration around the model.

## 2024-2025: Inference-Time Compute Became a New Scaling Axis

Traditional scaling spends most computation before deployment. A model is pretrained once, then each answer is generated with a relatively fixed amount of work per token.

Reasoning models changed that balance. OpenAI reported that [o1](https://openai.com/index/learning-to-reason-with-llms/) improved as both reinforcement-learning compute and time spent reasoning at inference increased. The model learned to break problems down, try alternatives, and correct mistakes before producing a final answer.

The [DeepSeek-R1](https://arxiv.org/abs/2501.12948) work provided more detail from an open research program. Large-scale reinforcement learning produced reasoning behaviors even without supervised fine-tuning in the initial R1-Zero model; a later multi-stage process added cold-start data and addressed readability and language-mixing problems. The work also showed that reasoning patterns could be distilled into smaller models.

This introduced a new engineering tradeoff. For a difficult problem, a system can spend more tokens, sample multiple candidate solutions, use a verifier, run tests, retrieve more evidence, or invoke tools. Capability is no longer determined only by the frozen weights. It also depends on the inference strategy and the budget assigned to the task.

The distinction is important:

- **pretraining compute** builds broad capability into the weights;
- **post-training compute** shapes behavior and specialized skills;
- **inference-time compute** decides how much effort to spend on this particular problem.

This is especially valuable for mathematics, coding, scientific questions, and agentic work where intermediate results can be checked. It is less obviously useful for every conversational request. More reasoning increases latency and cost, and a longer chain of steps can still amplify a bad assumption.

## What Actually Changed Across the Timeline

The history of LLMs is often compressed into model names and parameter counts. A more durable summary is a sequence of abstractions.

First, **distributed representations** replaced brittle symbolic counts with learned geometry. Then **attention and the Transformer** provided a scalable way to mix information across a sequence. **Pretraining** converted raw text into a reusable capability substrate. **Scaling laws and compute-optimal training** made capability growth more predictable. **Instruction and preference tuning** turned continuation models into assistants. **Retrieval, tools, and multimodality** connected those assistants to current information and the external world. Finally, **reasoning training and inference-time compute** taught systems to allocate more work to harder problems.

Each advance also exposed the next limitation.

Fluent generation revealed hallucination. Larger context windows revealed that access to information is not the same as using it correctly. Tool use revealed the need for permissions, observability, and recovery from failed actions. Human preference tuning revealed that preferred answers are not always true answers. Reasoning traces revealed new ways to search for solutions, but also new costs and failure modes.

The central technical object is therefore no longer just a neural network. It is a stack:

1. a pretrained model;
2. a post-training policy;
3. a context and memory system;
4. a set of tools and permissions;
5. an inference strategy;
6. an evaluation and feedback loop.

Two products using the same base model can behave very differently because the rest of this stack is different.

## Where the History Points Next

The next phase is unlikely to be defined by parameter count alone. Progress is moving toward better use of computation and better control of systems.

Data quality matters more as easily available text is exhausted. Synthetic data is useful when it can be verified, but dangerous when errors reinforce themselves. Smaller specialized models can outperform larger general models when latency, privacy, or local execution matters. Long context will continue to grow, while retrieval remains valuable for freshness, selectivity, and provenance. Agents will become more capable, but reliable long-horizon action will depend as much on software engineering as on model intelligence.

Evaluation may be the hardest layer. Static benchmarks saturate, leak into training data, and poorly represent real work. Useful evaluation increasingly requires private tasks, executable checks, adversarial testing, and observation over time.

The deepest continuity in this history is the next-token objective. The deepest change is everything built around it. What began as a better way to estimate language probabilities has become a general interface between learned representations and the rest of the digital world.

That is why the phrase "large language model" now describes both too much and too little. The model remains the engine, but the system is the product.
