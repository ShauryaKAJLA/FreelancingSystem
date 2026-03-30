CREATE TABLE Skills (
    skill_id INT PRIMARY KEY AUTO_INCREMENT,
    skill_name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
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
