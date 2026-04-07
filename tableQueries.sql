-- This file contains queries for table creation

-- Table: Users
CREATE TABLE Users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) NOT NULL UNIQUE,
    contact_number VARCHAR(15) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'client', 'freelancer') NOT NULL,

    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CHECK (email REGEXP '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CHECK (contact_number REGEXP '^[+]?[0-9]{10,15}$')
);


-- Table: Clients
CREATE TABLE Clients (
    client_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNIQUE,

    company_name VARCHAR(255) NOT NULL,
    website VARCHAR(255),
    total_spent DECIMAL(10, 2) DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CHECK (website IS NULL OR website REGEXP '^(https?://)?(www\\.)?[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}(/.*)?$'),
    CHECK (total_spent >= 0),
    CHECK (company_name REGEXP '^[A-Za-z0-9 .&-]+$'),

    FOREIGN KEY (user_id) REFERENCES Users(user_id)
        ON DELETE CASCADE ON UPDATE CASCADE
);


-- Table: Freelancers
CREATE TABLE Freelancers (
    freelancer_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL UNIQUE,

    full_name VARCHAR(255) NOT NULL,
    hourly_rate DECIMAL(10, 2) NOT NULL,
    total_earned DECIMAL(10, 2) DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CHECK (hourly_rate > 0),
    CHECK (total_earned >= 0),
    CHECK (full_name REGEXP '^[A-Za-z .&-]+$'),

    FOREIGN KEY (user_id) REFERENCES Users(user_id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- Skills table
CREATE TABLE Skills (
    skill_id INT PRIMARY KEY AUTO_INCREMENT,
    skill_name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- FreelancerSkills
CREATE TABLE FreelancerSkills (
    freelancer_id INT,
    skill_id INT,
    proficiency_level ENUM('Beginner', 'Intermediate', 'Expert') NOT NULL,

    PRIMARY KEY (freelancer_id, skill_id),

    FOREIGN KEY (freelancer_id) REFERENCES Freelancers(freelancer_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    FOREIGN KEY (skill_id) REFERENCES Skills(skill_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);
--TAble : JobPosts

CREATE TABLE job_posts(
    job_id INT PRIMARY KEY AUTO_INCREMENT,
    client_id INT NOT NULL,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    budget DECIMAL(10, 2) NOT NULL,
    status ENUM('Open', 'In Progress', 'Complete') NOT NULL DEFAULT 'Open',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL  DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX (client_id),
	FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE CASCADE
);
  
  -- Bids table
  CREATE TABLE Bids ( 
    bid_id INT PRIMARY KEY AUTO_INCREMENT, 
    job_id INT NOT NULL, 
    freelancer_id INT NOT NULL, 
    bid_amount DECIMAL(10,2) NOT NULL CHECK (bid_amount > 0), 
    status ENUM('Pending', 'Accepted', 'Rejected') DEFAULT 'Pending', 
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 
    CONSTRAINT fk_bid_job  
        FOREIGN KEY (job_id) REFERENCES Jobs(job_id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE, 
 
    CONSTRAINT fk_bid_freelancer  
        FOREIGN KEY (freelancer_id) REFERENCES Freelancers(freelancer_id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE, 
         
    CONSTRAINT unique_bid UNIQUE (job_id, freelancer_id) 
); 

--Contracts table
CREATE TABLE Contracts ( 
    contract_id INT PRIMARY KEY AUTO_INCREMENT, 
    job_id INT NOT NULL, 
    client_id INT NOT NULL, 
    freelancer_id INT NOT NULL, 
    start_date DATE NOT NULL, 
    end_date DATE, 
     
    status ENUM('Active', 'Completed', 'Cancelled') DEFAULT 'Active', 
     
    CONSTRAINT fk_contract_job  
        FOREIGN KEY (job_id) REFERENCES Jobs(job_id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE, 
         
    CONSTRAINT fk_contract_client  
        FOREIGN KEY (client_id) REFERENCES Clients(client_id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE, 
         
    CONSTRAINT fk_contract_freelancer  
        FOREIGN KEY (freelancer_id) REFERENCES Freelancers(freelancer_id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE, 
         
    CONSTRAINT chk_dates CHECK (end_date IS NULL OR end_date >= 
start_date), 
     
    CONSTRAINT unique_active_contract UNIQUE (job_id, freelancer_id) 
);  

--milestone table
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



-- Payments table

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

  
  --Admin_Action
  CREATE TABLE admin_actions (
    action_id INT PRIMARY KEY AUTO_INCREMENT,
    admin_id INT NOT NULL,
    action_type VARCHAR(100) NOT NULL,
    action_description TEXT,
    action_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES admins(admin_id) ON DELETE CASCADE
  
  );
  
  -- Collaboration table 
CREATE TABLE Collaboration (
    job_id INT PRIMARY KEY,
    freelancer_id INT,
    review_date DATE,

    

    FOREIGN KEY (job_id) REFERENCES JobPosts(job_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    FOREIGN KEY (freelancer_id) REFERENCES Freelancers(freelancer_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    
    CHECK (review_date IS NULL OR review_date <= CURRENT_DATE)
);
