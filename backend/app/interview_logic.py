import openai
from typing import Optional, List, Dict, Tuple
import os
from dotenv import load_dotenv
from pathlib import Path
import logging
import httpx
from backend.app.database import save_session

logger = logging.getLogger(__name__)

# Load environment variables
project_root = Path(__file__).resolve().parent.parent.parent
load_dotenv(project_root / ".env")

class InterviewBot:
    def __init__(self):
        # Configure HTTP client with proxy support
        proxy_url = os.getenv("OPENAI_PROXY")
        client_kwargs = {
            "limits": httpx.Limits(
                max_connections=100,
                max_keepalive_connections=20
            )
        }

        if proxy_url:
            client_kwargs["proxies"] = {
                "http://": proxy_url,
                "https://": proxy_url
            }

        self.http_client = httpx.AsyncClient(**client_kwargs)

        # Verify OpenAI API key
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable is missing")

        # Initialize OpenAI client
        self.client = openai.AsyncOpenAI(
            api_key=api_key,
            base_url=os.getenv("OPENAI_API_BASE", "https://api.openai.com/v1"),
            http_client=self.http_client
        )

        # Interview state
        self.topic: Optional[str] = None
        self.current_question: int = 0
        self.score: int = 0
        self.completed: bool = False
        self.answers: List[Tuple[str, str]] = []  # Stores (question, answer) pairs
        self.available_topics: List[str] = ["python", "system_architecture", "ai", "general_knowledge"]
        self.questions: Dict[str, List[Dict[str, List[str]]]] = {
            "python": [
                {"q": "Explain Python's GIL.", "keywords": ["global", "interpreter", "lock"]},
                {"q": "What are decorators in Python?", "keywords": ["decorator", "@", "function"]},
                {"q": "Differentiate between list and tuple.", "keywords": ["list", "tuple", "mutable"]},
                {"q": "What is list comprehension?", "keywords": ["list", "comprehension", "syntax"]},
                {"q": "Explain Python's lambda functions.", "keywords": ["lambda", "anonymous", "function"]},
                {"q": "What are Python generators?", "keywords": ["yield", "generator", "iterator"]},
                {"q": "What is the difference between 'is' and '=='?", "keywords": ["identity", "equality", "comparison"]},
                {"q": "Explain exception handling in Python.", "keywords": ["try", "except", "error"]},
                {"q": "What is the use of 'with' statement in Python?", "keywords": ["context", "manager", "with"]},
                {"q": "What is the purpose of the 'self' keyword?", "keywords": ["self", "class", "instance"]},
                {"q": "Explain the concept of inheritance in Python.", "keywords": ["inheritance", "OOP", "class"]},
                {"q": "What is multithreading in Python?", "keywords": ["threading", "parallel", "execution"]},
                {"q": "How does Python manage memory?", "keywords": ["memory", "garbage collection", "management"]},
                {"q": "What are Python modules and packages?", "keywords": ["module", "package", "import"]},
                {"q": "Explain the use of *args and **kwargs.", "keywords": ["args", "kwargs", "parameters"]}
            ],
            "system_architecture": [
                {"q": "What is system architecture?", "keywords": ["structure", "components", "design"]},
                {"q": "Explain the difference between monolithic and microservices architecture.", "keywords": ["monolithic", "microservices", "comparison"]},
                {"q": "What is the role of a system architect?", "keywords": ["design", "planning", "integration"]},
                {"q": "Describe the concept of scalability in system architecture.", "keywords": ["scalability", "horizontal", "vertical"]},
                {"q": "What is load balancing and why is it important?", "keywords": ["load balancing", "traffic distribution", "performance"]},
                {"q": "Explain the CAP theorem.", "keywords": ["consistency", "availability", "partition tolerance"]},
                {"q": "What are the key components of a distributed system?", "keywords": ["nodes", "network", "communication"]},
                {"q": "Describe the concept of fault tolerance.", "keywords": ["fault tolerance", "redundancy", "reliability"]},
                {"q": "What is a service-oriented architecture (SOA)?", "keywords": ["SOA", "services", "integration"]},
                {"q": "Explain the difference between synchronous and asynchronous communication.", "keywords": ["synchronous", "asynchronous", "communication"]},
                {"q": "What is a message queue and how is it used?", "keywords": ["message queue", "asynchronous", "communication"]},
                {"q": "Describe the concept of eventual consistency.", "keywords": ["eventual consistency", "distributed systems", "data"]},
                {"q": "What is a content delivery network (CDN)?", "keywords": ["CDN", "content distribution", "performance"]},
                {"q": "Explain the role of caching in system architecture.", "keywords": ["caching", "performance", "latency"]},
                {"q": "What are the benefits of using containers in system architecture?", "keywords": ["containers", "isolation", "deployment"]}
            ],
            "ai": [
                {"q": "What is artificial intelligence?", "keywords": ["AI", "intelligence", "machines"]},
                {"q": "Differentiate between AI, ML, and Deep Learning.", "keywords": ["AI", "machine learning", "deep learning"]},
                {"q": "What is supervised learning?", "keywords": ["supervised", "training", "labels"]},
                {"q": "Explain unsupervised learning.", "keywords": ["unsupervised", "clustering", "patterns"]},
                {"q": "What is reinforcement learning?", "keywords": ["reinforcement", "reward", "agent"]},
                {"q": "What are neural networks?", "keywords": ["neural networks", "layers", "nodes"]},
                {"q": "What is the Turing Test?", "keywords": ["Turing", "test", "intelligence"]},
                {"q": "Explain the concept of natural language processing (NLP).", "keywords": ["NLP", "language", "text"]},
                {"q": "What is computer vision?", "keywords": ["computer vision", "images", "analysis"]},
                {"q": "What are the ethical concerns in AI?", "keywords": ["ethics", "bias", "privacy"]},
                {"q": "What is overfitting in machine learning?", "keywords": ["overfitting", "model", "accuracy"]},
                {"q": "What is a confusion matrix?", "keywords": ["confusion matrix", "true", "false"]},
                {"q": "What is transfer learning?", "keywords": ["transfer learning", "pretrained", "reuse"]},
                {"q": "Explain the concept of feature extraction.", "keywords": ["feature extraction", "data", "attributes"]},
                {"q": "What is the role of AI in healthcare?", "keywords": ["AI", "healthcare", "diagnosis"]}
            ],
            "general_knowledge": [
                {"q": "Who was the first President of the United States?", "keywords": ["first", "president", "USA"]},
                {"q": "What is the capital of France?", "keywords": ["capital", "Paris", "France"]},
                {"q": "What is the largest ocean on Earth?", "keywords": ["largest", "ocean", "Earth"]},
                {"q": "Which planet is known as the Red Planet?", "keywords": ["planet", "Red", "Mars"]},
                {"q": "Who wrote the play 'Romeo and Juliet'?", "keywords": ["author", "Romeo", "Juliet"]},
                {"q": "In which year did World War I start?", "keywords": ["year", "World War I", "start"]},
                {"q": "What is the largest continent?", "keywords": ["largest", "continent", "Earth"]},
                {"q": "Which country is the Great Barrier Reef located in?", "keywords": ["Great Barrier Reef", "country", "Australia"]},
                {"q": "What is the square root of 64?", "keywords": ["square root", "64", "mathematics"]},
                {"q": "Who painted the Mona Lisa?", "keywords": ["artist", "Mona Lisa", "painting"]},
                {"q": "In which city would you find the Eiffel Tower?", "keywords": ["city", "Eiffel Tower", "Paris"]},
                {"q": "What is the tallest mountain in the world?", "keywords": ["tallest", "mountain", "world"]},
                {"q": "What is the longest river on Earth?", "keywords": ["longest", "river", "Earth"]},
                {"q": "Who invented the telephone?", "keywords": ["inventor", "telephone", "invention"]},
                {"q": "What is the currency of Japan?", "keywords": ["currency", "Japan", "yen"]}
            ]
        }

    async def close(self):
        await self.http_client.aclose()

    async def evaluate_answer(self, answer: str) -> int:
        """Evaluate answer and return score (0-3) based on keyword matching"""
        if not self.topic or self.current_question >= len(self.questions[self.topic]):
            return 0
            
        keywords = self.questions[self.topic][self.current_question]["keywords"]
        matches = sum(1 for kw in keywords if kw.lower() in answer.lower())
        return min(matches, 3)  # Max 3 points per question

    async def generate_response(self, message: str, client_ip: str = "localhost") -> str:
        try:
            logger.info(f"Received message: {message}")
            message = message.lower().strip()

            if message == "restart":
                return await self._handle_restart()
                
            if message == "feedback":
                return await self._handle_feedback_request()
                
            if self.topic is None:
                return await self._handle_topic_selection(message)
                
            if self.completed:
                return ("Interview already completed. "
                       "Type 'restart' to begin a new interview or 'feedback' to get feedback.")

            return await self._handle_question_flow(message, client_ip)
            
        except Exception as e:
            logger.error(f"Error processing message: {str(e)}", exc_info=True)
            return "An error occurred. Please try again."

    async def _handle_restart(self) -> str:
        """Reset the interview state"""
        self._reset_state()
        return "Interview restarted! Choose a topic: python, system_architecture, ai, general_knowledge"

    async def _handle_feedback_request(self) -> str:
        """Generate feedback for completed interview"""
        if not self.completed:
            return "Please complete the interview before requesting feedback."
            
        if not self.topic or not self.answers:
            return "No interview data available for feedback."
            
        try:
            feedback = await self._generate_ai_feedback()
            return feedback
        except Exception as e:
            logger.error(f"Error generating feedback: {str(e)}")
            return "Could not generate feedback. Please try again later."

    async def _generate_ai_feedback(self) -> str:
        """Generate feedback using OpenAI API"""
        prompt = (
            f"Generate interview feedback for a {self.topic} interview. "
            f"The candidate scored {self.score} out of {len(self.questions[self.topic])*3}. "
            "Here are the questions and answers:\n\n"
        )
        
        for i, (question, answer) in enumerate(self.answers):
            prompt += f"Question {i+1}: {question}\nAnswer: {answer}\n\n"
            
        prompt += (
            "Provide comprehensive feedback including:\n"
            "1. Overall performance assessment\n"
            "2. Strengths demonstrated\n"
            "3. Areas for improvement\n"
            "4. Specific suggestions for each question\n"
            "Format the response clearly with headings."
        )
        
        response = await self.client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=1000
        )
        
        return response.choices[0].message.content

    def _reset_state(self):
        """Reset all interview state variables"""
        self.topic = None
        self.current_question = 0
        self.score = 0
        self.completed = False
        self.answers = []

    async def _handle_topic_selection(self, message: str) -> str:
        """Handle topic selection logic"""
        if self.completed:
            return ("Previous interview completed. "
                   "Type 'restart' to begin a new interview or 'feedback' for feedback.")
            
        if message in self.available_topics:
            self.topic = message
            self.current_question = 0
            self.score = 0
            self.completed = False
            self.answers = []
            return self.questions[self.topic][0]["q"]
        else:
            return (f"Invalid topic. Please choose from: {', '.join(self.available_topics)}\n"
                   "Or type 'restart' to reset current interview.")

    async def _handle_question_flow(self, message: str, client_ip: str) -> str:
        """Handle the question-answer flow during interview"""
        if self.current_question >= len(self.questions[self.topic]):
            self.completed = True
            return ("No more questions in this interview. "
                   "Type 'feedback' to get feedback or 'restart' to start over.")
            
        # Store question and answer
        current_q = self.questions[self.topic][self.current_question]["q"]
        self.answers.append((current_q, message))
        
        # Evaluate answer
        score = await self.evaluate_answer(message)
        self.score += score
        self.current_question += 1
        
        # Check if interview completed
        if self.current_question >= len(self.questions[self.topic]):
            self.completed = True
            save_session(client_ip, self.topic, self.score)
            return (
                f"Interview complete!\n"
                f"Final score: {self.score}/{len(self.questions[self.topic])*3}\n\n"
                f"Type 'feedback' to get detailed feedback\n"
                f"Type 'restart' to begin a new interview"
            )
        
        # Return next question
        return self.questions[self.topic][self.current_question]["q"]