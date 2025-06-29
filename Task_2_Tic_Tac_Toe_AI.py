print("\nShrikant Kudale MIT ADT University B31 Batch - AI Internship Email- pixelreceives@gmail.com\n")
print("Task 2 - AI Internship : Tic-Tac-Toe AI with Minimax Algorithm\n")

# Initialize the board as a list of 9 elements
board = [' ' for _ in range(9)]

# Function to display the board
def print_board():
    print()
    print(f" {board[0]} | {board[1]} | {board[2]} ")
    print("---|---|---")
    print(f" {board[3]} | {board[4]} | {board[5]} ")
    print("---|---|---")
    print(f" {board[6]} | {board[7]} | {board[8]} ")
    print()

# Function to check for a winner
def check_winner(brd, player):
    win_conditions = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],  # Rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8],  # Columns
        [0, 4, 8], [2, 4, 6]              # Diagonals
    ]
    for cond in win_conditions:
        if brd[cond[0]] == brd[cond[1]] == brd[cond[2]] == player:
            return True
    return False

# Check if the board is full (draw)
def is_full(brd):
    return ' ' not in brd

# Minimax algorithm implementation
def minimax(brd, is_maximizing):
    if check_winner(brd, 'O'):
        return 1
    elif check_winner(brd, 'X'):
        return -1
    elif is_full(brd):
        return 0

    if is_maximizing:
        best_score = -float('inf')
        for i in range(9):
            if brd[i] == ' ':
                brd[i] = 'O'
                score = minimax(brd, False)
                brd[i] = ' '
                best_score = max(best_score, score)
        return best_score
    else:
        best_score = float('inf')
        for i in range(9):
            if brd[i] == ' ':
                brd[i] = 'X'
                score = minimax(brd, True)
                brd[i] = ' '
                best_score = min(best_score, score)
        return best_score

# Function for AI to make a move
def ai_move():
    best_score = -float('inf')
    move = -1
    for i in range(9):
        if board[i] == ' ':
            board[i] = 'O'
            score = minimax(board, False)
            board[i] = ' '
            if score > best_score:
                best_score = score
                move = i
    board[move] = 'O'

# Game loop
def play_game():
    print("Welcome to Tic-Tac-Toe! You are X, and the AI is O.")
    print("Enter positions from 1 to 9 as shown below:")
    print(" 1 | 2 | 3 ")
    print("---|---|---")
    print(" 4 | 5 | 6 ")
    print("---|---|---")
    print(" 7 | 8 | 9 ")

    print_board()

    while True:
        # Human player's turn
        try:
            user_move = int(input("Your move (1-9): ")) - 1
            if board[user_move] != ' ' or not (0 <= user_move <= 8):
                print("Invalid move! Try again.")
                continue
            board[user_move] = 'X'
        except (ValueError, IndexError):
            print("Please enter a valid number between 1 and 9.")
            continue

        print_board()

        if check_winner(board, 'X'):
            print("Congratulations! You win! 🎉")
            break
        if is_full(board):
            print("It's a draw! 🤝")
            break

        # AI's turn
        print("AI is thinking...\n")
        ai_move()
        print_board()

        if check_winner(board, 'O'):
            print("AI wins! Better luck next time. 🤖")
            break
        if is_full(board):
            print("It's a draw! 🤝")
            break

# Start the game
if __name__ == "__main__":
    play_game()
