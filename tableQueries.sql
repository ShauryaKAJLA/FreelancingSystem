-- This file contains queries for table creation

-- review table

CREATE TABLE Reviews (
review_id INT PRIMARY KEY AUTO_INCREMENT,
contract_id INT NOT NULL,
reviewer_id INT NOT NULL,
reviewee_id INT NOT NULL,
rating INT NOT NULL,
comment TEXT,

created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

FOREIGN KEY (contract_id) REFERENCES Contracts(contract_id)
ON DELETE CASCADE,

FOREIGN KEY (reviewer_id) REFERENCES Users(user_id)
ON DELETE CASCADE,

FOREIGN KEY (reviewee_id) REFERENCES Users(user_id)
ON DELETE CASCADE,

CHECK (rating >= 1 AND rating <= 5),
CHECK (reviewer_id <> reviewee_id),
UNIQUE (contract_id, reviewer_id)

INDEX idx_contract (contract_id),
INDEX idx_reviewee (reviewee_id),
INDEX idx_reviewer (reviewer_id)
);


-- message table

CREATE TABLE Messages (
message_id INT PRIMARY KEY AUTO_INCREMENT,
sender_id INT NOT NULL,
receiver_id INT NOT NULL,
message_text TEXT NOT NULL,

sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,

FOREIGN KEY (sender_id) REFERENCES Users(user_id)
ON DELETE CASCADE,

FOREIGN KEY (receiver_id) REFERENCES Users(user_id)
ON DELETE CASCADE,

CHECK (sender_id <> receiver_id),
CHECK (CHAR_LENGTH(message_text) > 0)

INDEX idx_sender (sender_id),
INDEX idx_receiver (receiver_id)
);