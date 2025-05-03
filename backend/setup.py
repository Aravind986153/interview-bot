from setuptools import setup, find_packages

setup(
    name="interview_app",
    version="0.1",
    packages=find_packages(),
    install_requires=[
        'fastapi==0.95.2',
        'uvicorn==0.22.0',
        'python-dotenv==1.0.0',
        'httpx==0.28.1',
        'openai==1.77.0',
        'sqlmodel==0.0.14',
        'psycopg2-binary==2.9.9',
    ],
)
