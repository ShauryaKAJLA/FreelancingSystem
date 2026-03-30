Milestone tables:

CREATE TABLE Milestones (
    milestone_id INT PRIMARY KEY,
    
    contract_id INT NOT NULL,
    
    title VARCHAR(100) NOT NULL,
    
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    
    status VARCHAR(20) NOT NULL 
        CHECK (status IN ('Pending', 'Completed')),
    
    due_date DATE NOT NULL,
    
    CONSTRAINT fk_milestone_contract
    FOREIGN KEY (contract_id) 
    REFERENCES Contracts(contract_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

Payments table:

CREATE TABLE Payments (
    payment_id INT PRIMARY KEY,
    
    milestone_id INT NOT NULL,
    
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    
    payment_date DATE NOT NULL,
    
    payment_status VARCHAR(20) NOT NULL 
        CHECK (payment_status IN ('Paid', 'Pending', 'Failed')),
    
    CONSTRAINT fk_payment_milestone
    FOREIGN KEY (milestone_id) 
    REFERENCES Milestones(milestone_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);









