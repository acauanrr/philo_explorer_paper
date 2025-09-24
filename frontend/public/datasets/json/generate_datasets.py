#!/usr/bin/env python3

import json
import random
from datetime import datetime, timedelta

# Categories with realistic distribution
CATEGORIES = ["POLITICS", "WELLNESS", "TRAVEL", "BUSINESS", "TECH", "SCIENCE",
              "ENTERTAINMENT", "SPORTS", "EDUCATION", "WORLD", "FOOD & DRINK",
              "STYLE & BEAUTY", "PARENTING", "HOME & LIVING", "CRIME"]

# Sample authors
AUTHORS = ["Michael Chen", "Sarah Johnson", "David Martinez", "Emily Wilson",
           "James Anderson", "Maria Rodriguez", "John Smith", "Lisa Brown",
           "Robert Davis", "Jennifer Taylor", "Christopher Lee", "Amanda White",
           "Daniel Thompson", "Michelle Garcia", "Kevin Wilson", "Rachel Adams"]

# Generate realistic news articles
def generate_news_article(id_num, category, date_str):

    news_templates = {
        "POLITICS": [
            {
                "title": f"Senate Passes Major Infrastructure Bill After Months of Negotiations",
                "content": f"The U.S. Senate has passed a comprehensive infrastructure bill worth $1.2 trillion after months of bipartisan negotiations. The bill includes funding for roads, bridges, public transit, broadband internet, and clean energy initiatives. Senator leaders from both parties hailed the achievement as a rare example of bipartisan cooperation in today's polarized political climate. The legislation now moves to the House of Representatives where it faces additional scrutiny from progressive Democrats who want more climate provisions and conservative Republicans concerned about spending levels. If passed, this would represent the largest infrastructure investment in decades.",
                "short_description": "Historic infrastructure bill passes Senate with bipartisan support"
            },
            {
                "title": f"Election Security Measures Face Resistance in Key Swing States",
                "content": f"New election security legislation is meeting strong resistance in several key swing states as lawmakers debate voting access versus security concerns. The proposed measures include voter ID requirements, limits on mail-in voting, and enhanced signature verification processes. Civil rights groups argue these measures could disenfranchise minority voters, while supporters claim they're necessary to ensure election integrity. The debate reflects deeper national divisions about voting rights and has implications for upcoming midterm elections. Several states have already passed similar measures, leading to legal challenges that may reach the Supreme Court.",
                "short_description": "Voting rights debate intensifies as states consider new election laws"
            }
        ],
        "WELLNESS": [
            {
                "title": f"New Study Links Mediterranean Diet to Improved Mental Health",
                "content": f"A comprehensive study involving over 10,000 participants has found strong links between Mediterranean diet adherence and improved mental health outcomes. Researchers tracked participants over five years, monitoring their dietary habits and mental health indicators including depression, anxiety, and cognitive function. Those who closely followed the Mediterranean diet, rich in olive oil, fish, vegetables, and whole grains, showed 33% lower rates of depression and 25% better cognitive test scores. The study suggests that the diet's anti-inflammatory properties and high omega-3 content may protect brain health. Nutritionists are calling this the most compelling evidence yet for diet's role in mental wellness.",
                "short_description": "Mediterranean diet shows promise for mental health improvement"
            },
            {
                "title": f"Morning Routines of High Performers: What Science Says Works",
                "content": f"Sleep researchers and productivity experts have analyzed the morning routines of successful individuals to identify evidence-based practices that enhance performance. The findings reveal that consistent wake times, exposure to natural light within 30 minutes of waking, and delayed caffeine consumption (90-120 minutes after waking) are key factors. Additionally, incorporating 10-15 minutes of meditation or mindfulness practice showed significant improvements in focus and stress management throughout the day. Exercise, even just 20 minutes of walking, was another common factor among high performers. The research challenges popular productivity myths and provides actionable insights for optimizing morning routines.",
                "short_description": "Science-backed morning habits that boost productivity and wellness"
            }
        ],
        "TECH": [
            {
                "title": f"AI Breakthrough: New Language Model Achieves Human-Level Reasoning",
                "content": f"Researchers at a leading AI laboratory have announced a breakthrough in artificial intelligence with a new language model that demonstrates human-level reasoning capabilities across multiple domains. The model, trained on a novel architecture that combines traditional transformer networks with symbolic reasoning modules, scored above 90% on advanced reasoning benchmarks that typically stump current AI systems. This includes complex mathematical proofs, multi-step logical deductions, and nuanced ethical reasoning. The development raises both excitement about AI's potential to solve complex problems and concerns about safety and control. Industry experts predict this could accelerate AI adoption in fields requiring sophisticated decision-making, from medical diagnosis to legal analysis.",
                "short_description": "Revolutionary AI model matches human reasoning capabilities"
            },
            {
                "title": f"Quantum Computing Milestone: Error Rate Drops Below Critical Threshold",
                "content": f"A major quantum computing company has achieved a historic milestone by reducing quantum bit (qubit) error rates below the critical threshold needed for practical quantum computing. Using a new error correction algorithm and improved hardware design, the team maintained 1000 logical qubits with error rates below 0.01% for over 24 hours. This breakthrough brings quantum computers closer to solving real-world problems in drug discovery, materials science, and cryptography. The achievement required cooling qubits to near absolute zero and isolating them from environmental interference. Experts predict this could accelerate the timeline for commercially viable quantum computers by several years.",
                "short_description": "Quantum computing breakthrough brings practical applications closer"
            }
        ],
        "BUSINESS": [
            {
                "title": f"Global Supply Chain Disruptions Force Companies to Rethink Strategy",
                "content": f"Major corporations are fundamentally restructuring their supply chains in response to ongoing global disruptions that have exposed vulnerabilities in just-in-time manufacturing. Companies are moving from single-source suppliers to diversified networks, increasing inventory buffers, and bringing production closer to end markets. The shift represents a reversal of decades-old efficiency practices that prioritized cost reduction over resilience. Technology companies are particularly affected, with semiconductor shortages forcing production delays and lost revenue. Economic analysts estimate that supply chain restructuring could add 5-10% to production costs but significantly reduce risk exposure. The changes are expected to reshape global trade patterns for years to come.",
                "short_description": "Companies restructure supply chains prioritizing resilience over efficiency"
            },
            {
                "title": f"Cryptocurrency Regulation Takes Shape as Major Nations Coordinate",
                "content": f"The world's largest economies are coordinating efforts to establish comprehensive cryptocurrency regulations, marking a turning point for the digital asset industry. The proposed framework includes licensing requirements for exchanges, tax reporting standards, and consumer protection measures. While the industry has welcomed regulatory clarity, some provisions around privacy and decentralization have sparked debate. Major financial institutions are preparing to offer cryptocurrency services once regulations are finalized, potentially bringing trillions in institutional investment. The coordinated approach aims to prevent regulatory arbitrage while fostering innovation. Implementation is expected to begin next year, fundamentally changing how digital assets operate globally.",
                "short_description": "Global cryptocurrency regulations promise clarity for digital asset industry"
            }
        ],
        "SCIENCE": [
            {
                "title": f"CRISPR Gene Therapy Shows Promise in Treating Inherited Blindness",
                "content": f"Clinical trials using CRISPR gene editing technology have shown remarkable success in treating Leber congenital amaurosis, a rare inherited form of blindness. Researchers directly injected the gene-editing tool into patients' eyes, targeting the mutation causing vision loss. After six months, 80% of participants showed significant vision improvement, with some able to navigate in low light for the first time. The breakthrough represents the first successful in-vivo CRISPR treatment for a sensory disorder. The technique could potentially treat other genetic eye diseases affecting millions worldwide. However, researchers emphasize the need for long-term safety monitoring as gene editing effects are permanent.",
                "short_description": "Gene editing restores sight in groundbreaking clinical trial"
            },
            {
                "title": f"Ocean Temperatures Break Records, Accelerating Climate Concerns",
                "content": f"Global ocean temperatures have reached unprecedented levels, with measurements showing sustained warming beyond worst-case climate projections. The warming is disrupting marine ecosystems, accelerating ice sheet melting, and intensifying tropical storms. Scientists report mass coral bleaching events occurring simultaneously across three ocean basins for the first time. The warmer waters are also reducing the ocean's capacity to absorb atmospheric carbon dioxide, potentially accelerating climate change. Marine biologists document species migrations toward poles at rates never before observed. The findings have prompted calls for immediate action on emissions reduction and ecosystem protection. Researchers warn that ocean warming effects will persist for centuries even if emissions stop today.",
                "short_description": "Record ocean warming triggers ecosystem crisis and climate acceleration"
            }
        ],
        "ENTERTAINMENT": [
            {
                "title": f"Streaming Services Consolidate as Competition Intensifies",
                "content": f"The streaming landscape is undergoing major consolidation as services struggle with subscriber growth and rising content costs. Two major platforms announced a merger that would create the second-largest streaming service globally, combining extensive content libraries and production capabilities. The move reflects industry challenges including password sharing, market saturation, and consumer fatigue from multiple subscriptions. Industry analysts predict further consolidation, with smaller services likely to be absorbed or shut down. Content creators express concern about fewer buyers for their projects, while consumers worry about rising prices. The shift marks the end of the streaming wars' expansion phase and the beginning of a consolidation era that could reshape entertainment consumption.",
                "short_description": "Major streaming merger signals industry consolidation phase"
            }
        ],
        "SPORTS": [
            {
                "title": f"Olympic Committee Announces Major Changes to Summer Games Format",
                "content": f"The International Olympic Committee has unveiled sweeping changes to the Summer Olympics format, adding new sports while reducing athlete quotas in traditional events. Breaking, skateboarding, and surfing will become permanent Olympic sports, reflecting efforts to attract younger audiences. Meanwhile, some track and field events face reduced participation limits. The changes also include mixed-gender events in every sport and sustainability requirements for host cities. Athletes have mixed reactions, with newer sports celebrating inclusion while traditional sports worry about reduced opportunities. The reforms represent the most significant Olympic program changes in decades, aimed at maintaining relevance in a changing sports landscape.",
                "short_description": "Olympics embraces new sports while restructuring traditional events"
            }
        ],
        "WORLD": [
            {
                "title": f"Global Refugee Crisis Reaches Historic Levels, UN Reports",
                "content": f"The United Nations High Commissioner for Refugees reports that global displacement has reached unprecedented levels, with over 100 million people forcibly displaced worldwide. Conflicts, climate change, and economic instability are driving factors behind the crisis. The report highlights particular concerns in regions experiencing compound crises where conflict intersects with climate disasters. Host countries struggle to provide adequate services while facing their own economic challenges. International aid organizations warn of funding shortfalls as needs outpace resources. The crisis is reshaping migration policies globally, with some nations tightening borders while others expand refugee programs. Long-term solutions remain elusive as root causes persist and new conflicts emerge.",
                "short_description": "UN reports record global displacement amid compound crises"
            }
        ],
        "EDUCATION": [
            {
                "title": f"Universities Embrace AI Tools While Grappling with Academic Integrity",
                "content": f"Higher education institutions worldwide are rapidly adapting to the reality of AI-powered writing tools, developing new policies that balance innovation with academic integrity. Rather than banning AI outright, many universities are teaching students to use these tools ethically and effectively. New assessment methods focus on in-class work, oral presentations, and process documentation. Some institutions require students to document AI assistance, treating it like citing sources. Faculty report mixed experiences, with some embracing AI for enhancing learning while others worry about skill deterioration. The shift represents a fundamental rethinking of education in the AI age, with implications for curriculum design and skill development.",
                "short_description": "Universities adapt teaching methods for the AI era"
            }
        ]
    }

    # Select appropriate templates for the category
    templates = news_templates.get(category, news_templates["TECH"])
    template = random.choice(templates)

    return {
        "id": id_num,
        "category": category,
        "title": template["title"],
        "content": template["content"],
        "date": date_str,
        "authors": random.choice(AUTHORS),
        "link": f"https://news.example.com/article/{id_num}",
        "short_description": template["short_description"]
    }

# Generate T1 dataset (200 articles)
def generate_t1_dataset():
    articles = []
    start_date = datetime(2020, 1, 1)

    for i in range(200):
        # Distribute categories somewhat evenly with slight variation
        category = CATEGORIES[i % len(CATEGORIES)]

        # Random date between 2020-2023
        days_offset = random.randint(0, 1095)  # ~3 years
        article_date = start_date + timedelta(days=days_offset)
        date_str = article_date.strftime("%Y-%m-%d")

        article = generate_news_article(i + 1, category, date_str)
        articles.append(article)

    # Shuffle to mix categories
    random.shuffle(articles)

    # Reassign IDs after shuffling
    for i, article in enumerate(articles):
        article["id"] = i + 1

    return articles

# Generate T2 dataset (210 articles - T1 + 10 new)
def generate_t2_dataset(t1_articles):
    t2_articles = t1_articles.copy()

    # Add 10 new recent articles (2023-2024)
    start_date = datetime(2023, 6, 1)
    new_articles_categories = ["TECH", "SCIENCE", "POLITICS", "WELLNESS", "BUSINESS",
                               "WORLD", "ENTERTAINMENT", "SPORTS", "EDUCATION", "CRIME"]

    for i in range(10):
        category = new_articles_categories[i]
        days_offset = random.randint(0, 365)
        article_date = start_date + timedelta(days=days_offset)
        date_str = article_date.strftime("%Y-%m-%d")

        article = generate_news_article(201 + i, category, date_str)
        # Mark these as "recent" for tracking
        article["recent"] = True
        t2_articles.append(article)

    return t2_articles

# Generate the datasets
print("Generating T1 dataset with 200 articles...")
t1_dataset = generate_t1_dataset()

print("Generating T2 dataset with 210 articles...")
t2_dataset = generate_t2_dataset(t1_dataset)

# Save datasets
with open("T1_news_dataset_full.json", "w") as f:
    json.dump(t1_dataset, f, indent=2)

with open("T2_news_dataset_full.json", "w") as f:
    json.dump(t2_dataset, f, indent=2)

print(f"✅ Generated T1 dataset: {len(t1_dataset)} articles")
print(f"✅ Generated T2 dataset: {len(t2_dataset)} articles")

# Generate summary statistics
categories_t1 = {}
for article in t1_dataset:
    cat = article["category"]
    categories_t1[cat] = categories_t1.get(cat, 0) + 1

categories_t2 = {}
for article in t2_dataset:
    cat = article["category"]
    categories_t2[cat] = categories_t2.get(cat, 0) + 1

print("\n📊 Category Distribution:")
print("T1 Dataset:", categories_t1)
print("T2 Dataset:", categories_t2)

print("\n✨ New articles in T2:", len([a for a in t2_dataset if a.get("recent")]))