import React from 'react';

const Footer = () => {
  return (
    <footer className="bg-light mt-auto py-3">
      <div className="container">
        <div className="row">
          <div className="col-md-6">
            <p className="text-muted mb-0">
              &copy; 2024 PhotoShare. All rights reserved.
            </p>
          </div>
          <div className="col-md-6 text-md-end">
            <p className="text-muted mb-0">
              写真を共有して、思い出を残そう
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;