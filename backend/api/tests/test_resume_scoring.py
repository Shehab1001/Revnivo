from django.test import SimpleTestCase

from api.resumes import (
    _analyze_resume_match,
    _ats_readiness_report,
)


JOB_DESCRIPTION = """
Senior Data Scientist

We are looking for a Senior Data Scientist to build and evaluate
machine learning systems for production analytics products.

Requirements:
- Must have strong Python and SQL experience.
- Minimum 3 years of experience with machine learning and data science.
- Experience with pandas, scikit-learn, model evaluation, feature engineering,
  statistical analysis, and data visualization.
- Proficiency in REST APIs and version control.
- Experience deploying models and collaborating with software engineering teams.

Responsibilities:
Build predictive models, analyze large datasets, design experiments,
communicate results, maintain reproducible pipelines, and work with product
and engineering stakeholders to deliver reliable data products.
"""


def _base_profile():
    return {
        "full_name": "Example Candidate",
        "headline": "Professional",
        "email": "candidate@example.com",
        "phone": "+1 555 111 2222",
        "location": "Remote",
        "website": "",
        "linkedin": "",
        "github": "",
    }


def _relevant_resume():
    return {
        "profile": {
            **_base_profile(),
            "headline": "Senior Data Scientist",
        },
        "summary": (
            "Data scientist focused on production machine learning, "
            "statistical analysis, model evaluation, and data products."
        ),
        "experience": [
            {
                "title": "Data Scientist",
                "company": "Example Analytics",
                "summary": (
                    "Built machine learning pipelines using Python and SQL."
                ),
                "bullets": [
                    "Improved model precision by 18% through feature engineering.",
                    "Used pandas and scikit-learn for model training and evaluation.",
                    "Built REST APIs and reproducible data pipelines for production.",
                ],
            }
        ],
        "education": [
            {
                "school": "Example University",
                "degree": "BSc",
                "field": "Computer Science",
            }
        ],
        "skills": [
            "Python",
            "SQL",
            "Machine Learning",
            "Pandas",
            "Scikit-learn",
            "Feature Engineering",
            "Statistical Analysis",
            "Data Visualization",
            "REST APIs",
            "Version Control",
        ],
        "projects": [
            {
                "name": "Model Evaluation Platform",
                "role": "Developer",
                "description": (
                    "Designed model evaluation workflows and predictive models."
                ),
                "technologies": [
                    "Python",
                    "SQL",
                ],
                "bullets": [
                    "Automated experiment reporting and model comparison."
                ],
            }
        ],
        "certifications": [],
        "languages": [],
    }


def _unrelated_resume():
    return {
        "profile": {
            **_base_profile(),
            "headline": "Retail Operations Manager",
        },
        "summary": (
            "Retail operations manager with experience in store scheduling, "
            "inventory control, customer service, and vendor coordination."
        ),
        "experience": [
            {
                "title": "Store Manager",
                "company": "Example Retail",
                "summary": (
                    "Managed daily store operations and customer service."
                ),
                "bullets": [
                    "Reduced stock loss by 12% through inventory controls.",
                    "Scheduled staff and coordinated vendor deliveries.",
                    "Improved customer satisfaction across store operations.",
                ],
            }
        ],
        "education": [
            {
                "school": "Example College",
                "degree": "BA",
                "field": "Business",
            }
        ],
        "skills": [
            "Inventory",
            "Scheduling",
            "Customer Service",
            "Vendor Management",
            "Retail Operations",
        ],
        "projects": [],
        "certifications": [],
        "languages": [],
    }


class ResumeScoringTests(SimpleTestCase):
    def test_relevant_resume_scores_materially_higher_than_unrelated_resume(self):
        relevant = _analyze_resume_match(
            _relevant_resume(),
            JOB_DESCRIPTION,
        )
        unrelated = _analyze_resume_match(
            _unrelated_resume(),
            JOB_DESCRIPTION,
        )

        self.assertGreater(
            relevant["score"],
            unrelated["score"] + 25,
        )
        self.assertGreater(
            relevant["keyword_score"],
            unrelated["keyword_score"],
        )
        self.assertGreater(
            relevant["evidence_score"],
            unrelated["evidence_score"],
        )
        self.assertLess(
            unrelated["score"],
            50,
        )

    def test_skills_only_keyword_stuffing_is_penalized(self):
        stuffed = _unrelated_resume()
        stuffed["skills"] = [
            "Python",
            "SQL",
            "Machine Learning",
            "Data Science",
            "Pandas",
            "Scikit-learn",
            "Feature Engineering",
            "Statistical Analysis",
            "Data Visualization",
            "REST APIs",
            "Version Control",
            "Model Evaluation",
        ]

        result = _analyze_resume_match(
            stuffed,
            JOB_DESCRIPTION,
        )

        self.assertGreater(
            result["keyword_score"],
            result["evidence_score"],
        )
        self.assertGreater(
            result["diagnostics"]["keyword_stuffing_penalty"],
            0,
        )
        self.assertLess(
            result["score"],
            70,
        )

    def test_general_readiness_is_not_presented_as_perfect_ats(self):
        resume = _relevant_resume()
        report = _ats_readiness_report(
            resume,
            raw_text=(
                " ".join(
                    [
                        resume["summary"],
                        JOB_DESCRIPTION,
                    ]
                )
                * 4
            ),
        )

        self.assertLessEqual(
            report["score"],
            95,
        )
        self.assertEqual(
            report["kind"],
            "resume_readiness",
        )
        self.assertIn(
            "no target job description",
            report["disclaimer"].lower(),
        )

    def test_job_match_does_not_get_free_perfect_score(self):
        result = _analyze_resume_match(
            _relevant_resume(),
            JOB_DESCRIPTION,
        )

        self.assertLess(
            result["score"],
            100,
        )
        self.assertGreater(
            result["diagnostics"]["job_terms_analyzed"],
            10,
        )
