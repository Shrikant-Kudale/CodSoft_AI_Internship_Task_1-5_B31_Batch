print("\nShrikant Kudale MIT ADT University B31 Batch - AI Internship Email- pixelreceives@gmail.com\n")
print("Task 1 - AI Internship : Chatbot With Rule Based Responses\n")
# Importing required libraries
import re
from datetime import datetime

# Start of the chatbot
print("🤖 Hello! I am your AI chatbot. Ask me anything, or type 'exit' to end the chat.\n")


# Function to generate rule-based responses
def chatbot_response(user_input):
    user_input = user_input.lower()

    if any(greet in user_input for greet in ["hi", "hello", "hey"]):
        return "Hello there! How can I help you today? 😊"

    elif "your name" in user_input or "who are you" in user_input:
        return "I'm your friendly AI chatbot, built by Shrikant Kudale as part of his AI internship."

    elif "shrikant" in user_input:
        return "Shrikant Kudale is a passionate AI intern from MIT ADT University, always eager to learn and build cool things!"

    elif "help" in user_input or "what can you do" in user_input:
        return "I can answer your basic questions, talk about general topics, and demonstrate rule-based logic. Try asking me anything!"

    elif "time" in user_input:
        return f"The current time is {datetime.now().strftime('%I:%M %p')}."

    elif "thank" in user_input:
        return "You're most welcome! 😊"

    elif any(word in user_input for word in ["bye", "exit", "quit"]):
        return "It was nice chatting with you. Have a great day! 👋"

    elif "weather" in user_input:
        return "I can't fetch real-time weather yet, but it’s always sunny in the world of Python!"

    else:
        return "I'm sorry, I didn't understand that. Can you rephrase it or ask something else?"


# Start the conversation loop
while True:
    try:
        user_input = input("You: ")
        if user_input.strip().lower() in ['exit', 'quit', 'bye']:
            print("Bot:", chatbot_response(user_input))
            break
        response = chatbot_response(user_input)
        print("Bot:", response)
        print()
    except KeyboardInterrupt:
        print("\nBot: Chat ended by user. Goodbye! 👋")
        break
    except Exception as e:
        print("Bot: Oops! Something went wrong. Please try again.")
        print(f"(Error: {str(e)})")
