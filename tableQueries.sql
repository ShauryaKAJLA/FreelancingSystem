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