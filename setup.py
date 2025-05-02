from setuptools import setup, find_packages

setup(
    name="interview_bot",
    version="0.1",
    packages=find_packages(where="backend"),
    package_dir={"": "backend"},
    install_requires=[
        'fastapi',
        'uvicorn',
        'sqlmodel',
        'python-dotenv',
        'alembic'
    ],
)