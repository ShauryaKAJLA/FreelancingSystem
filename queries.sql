
-- Jobs Management
-- Get all jobs
SELECT * FROM JOBS WHERE STATUS="Open";
-- Get all jobs posted by a particular client
-- ID = GIVEN BY USER
SELECT * FROM JOBS WHERE client_id = ID;
-- Get job by ID (detailed view)
SELECT * FROM JOBS WHRE job_id = ID;
-- Update job details
-- DATA WILL BE GIVEN FROM USERS 
UPDATE JOBS SET title = NEW_TITLE, description = NEW_DESC, budget = NEW_BUDGET WHERE job_id = ID;
-- Delete job
DELETE FROM JOBS WHERE job_id = ID;
-- Close job (stop accepting bids)
UPDATE FROM JOBS SET STATUS="In Progress" WHERE job_id = ID ;

-- Bids Management

-- Get all bids for a job
SELECT * FROM Bids WHERE job_id = ID;
-- Get all bids placed by a freelancer      
SELECT * FROM Bids WHERE freelancer_id=ID;
-- Filter bids by:
-- Pay (min/max budget)
SELECT * FROM Bids ORDER BY bid_amount DESC;
SELECT * FROM Bids ORDER BY bid_amount ASC;
-- Freelancer rating
create view FreelancerDashboard as
    SELECT f.freelancer_id ,
        f.hourly_rate ,
        f.total_earned,
        avg(r.rating) as avg_rating
        from Reviews as r join Freelancers as f on f.freelancer_id=r.reviewee_id group by f.freelancer_id;
 
--ammount is given by user to make sure the output only includes only those freelancers that have rating more than or equal to give number and hourly rate less than or equal to given number
SELECT  b.bid_id , 
    b.job_id, 
    b.freelancer_id, 
    b.bid_amount ,b.status,f.avg_rating FROM Bids AS b JOIN FreelancerDashboard AS f ON b.freelancer_id=f.freelancer_id WHERE f.avg_rating >= RATING ORDER BY f.avg_rating DESC;

CREATE VIEW ClientDashboard AS
    SELECT c.client_id ,
        c.company_name ,
        c.total_spent,
        avg(r.rating) as avg_rating
        from Reviews as r join Client as c on c.client_id=r.reviewee_id group by c.client_id;
--get jobs based on client rating
select j.job_id ,j.client_id ,j.title ,j.description ,j.budget ,j.status ,c.avg_rating from 
Jobs as j join ClientDashboard as c on j.client_id=c.client_id where c.avg_rating >= RATING ORDER BY c.avg_rating DESC; 
  
  -- Sort bids by:
-- Lowest price
SELECT * FROM Bids ORDER BY bid_amount ASC;
-- Highest rating
SELECT  b.bid_id , 
    b.job_id, 
    b.freelancer_id, 
    b.bid_amount ,b.status,f.avg_rating FROM Bids AS b JOIN FreelancerDashboard AS f ON b.freelancer_id=f.freelancer_id ORDER BY f.avg_rating DESC;
-- Top 3 bids (greedy selection based on best combination of low pay + high rating)
SELECT  b.bid_id , 
    b.job_id, 
    b.freelancer_id, 
    b.bid_amount ,b.status,f.avg_rating FROM Bids AS b JOIN FreelancerDashboard AS f ON b.freelancer_id=f.freelancer_id ORDER BY (bid_amount/f.avg_rating) ASC LIMIT 3;

--Trigger to create new milestone after the payment status of current milestone is updated to 'paid' and if it was the last milestone then update contract as 'completed' and job as closed.
DELIMITER $$

CREATE TRIGGER payment_workflow
AFTER UPDATE ON Payments
FOR EACH ROW
BEGIN

    IF NEW.payment_status = 'Paid' 
       AND OLD.payment_status <> 'Paid' THEN

        -- Check if there exists another milestone for same contract
        IF EXISTS (
            SELECT 1
            FROM Milestones m
            WHERE m.contract_id = (
                SELECT contract_id 
                FROM Milestones 
                WHERE milestone_id = NEW.milestone_id
            )
            AND m.milestone_id <> NEW.milestone_id
        ) THEN

            -- Create next milestone
            INSERT INTO Milestones (
                contract_id,
                title,
                amount,
                status,
                due_date
            )
            SELECT 
                m.contract_id,
                CONCAT(m.title, ' - Next'),
                m.amount,
                'Pending',
                DATE_ADD(m.due_date, INTERVAL 7 DAY)
            FROM Milestones m
            WHERE m.milestone_id = NEW.milestone_id;

        ELSE

            -- No more milestones → complete contract
            UPDATE Contracts
            SET status = 'Completed'
            WHERE contract_id = (
                SELECT contract_id 
                FROM Milestones 
                WHERE milestone_id = NEW.milestone_id
            );

            -- Complete job
            UPDATE Jobs
            SET status = 'Complete'
            WHERE job_id = (
                SELECT job_id 
                FROM Contracts 
                WHERE contract_id = (
                    SELECT contract_id 
                    FROM Milestones 
                    WHERE milestone_id = NEW.milestone_id
                )
            );

        END IF;

    END IF;

END $$

DELIMITER ;

--a trigger to add payment given by client that is now on the system to get added to freelancers account after client updates milestone as completed.
DELIMITER $$

CREATE TRIGGER add_payment_to_freelancer
AFTER UPDATE ON Milestones
FOR EACH ROW
BEGIN

    IF NEW.status = 'Completed' 
       AND OLD.status <> 'Completed' THEN

        UPDATE Freelancers f
        JOIN Contracts c ON f.freelancer_id = c.freelancer_id
        JOIN Milestones m ON c.contract_id = m.contract_id
        JOIN Payments p ON m.milestone_id = p.milestone_id
        SET f.total_earned = f.total_earned + p.amount
        WHERE m.milestone_id = NEW.milestone_id
          AND p.payment_status = 'Paid';

    END IF;

END $$

DELIMITER ;

