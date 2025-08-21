"""
Autonomous AI Agent Framework with Reinforcement Learning

A dynamic, self-improving agent system that learns to earn autonomously
through various strategies and revenue streams.
"""

__version__ = "1.0.0"
__author__ = "Reflex Coder"

from .core.agent import AutonomousAgent
from .core.environment import MarketEnvironment
from .earning.earning_manager import EarningManager
from .rl.rl_engine import ReinforcementLearner

__all__ = [
    "AutonomousAgent",
    "MarketEnvironment", 
    "EarningManager",
    "ReinforcementLearner"
]