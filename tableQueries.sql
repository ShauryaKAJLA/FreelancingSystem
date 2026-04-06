Milestone tables:

CREATE TABLE Milestones (
    milestone_id INT PRIMARY KEY,
    
    contract_id INT NOT NULL,
    
    title VARCHAR(100) NOT NULL,
    
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    
    status ENUM('Pending', 'Completed') NOT NULL DEFAULT 'Pending',
    
    due_date DATE NOT NULL,
    
    CONSTRAINT fk_milestone_contract
    FOREIGN KEY (contract_id) 
    REFERENCES Contracts(contract_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);
INDEX idx_contract_id (contract_id),
    INDEX idx_status (status),
    INDEX idx_due_date (due_date)
);



Payments table:

CREATE TABLE Payments (
    payment_id INT PRIMARY KEY,
    
    milestone_id INT NOT NULL,
    
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    
    payment_date DATE NOT NULL,
    
    payment_status ENUM('Paid', 'Pending', 'Failed') NOT NULL DEFAULT 'Pending',
    
    CONSTRAINT fk_payment_milestone
    FOREIGN KEY (milestone_id) 
    REFERENCES Milestones(milestone_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);
INDEX idx_milestone_id (milestone_id),
    INDEX idx_payment_status (payment_status),
    INDEX idx_payment_date (payment_date)
);







