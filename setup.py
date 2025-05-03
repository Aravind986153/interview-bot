from setuptools import setup, find_packages

setup(
    name="interview_app",
    version="0.1",
    packages=find_packages(),
    install_requires=[
        "fastapi==0.68.0",
        "uvicorn==0.15.0",
        "sqlmodel==0.0.8",
        "psycopg2-binary==2.9.6",
        "python-dotenv==0.19.0"
    ],
)
