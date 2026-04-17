--trigger to create a new milestone when the payment status of current milestone for freelancer gets updated to 'paid' and if it is last milestone then trigger the status of contract to 'completed' and job to 'closed'.
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

            -- Close the job
            UPDATE Jobs
            SET status = 'Closed'
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

--trigger to add payment given by client that is now on the system to get added to respective freelancer's account after client updates milestone as completed.
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
