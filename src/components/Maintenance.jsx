import {Container, Row, Col} from "react-bootstrap";

function maintenance() {
    return (
        <>
            <Container style={{height: "100vh"}}>
                <Row>
                    <Col>
                        <div className="welcome">
                            <h1 className="title">Yeahlolnice</h1>
                        </div> 
                    </Col>
                </Row>
                <Row className="maintenanceLoad">
                    <Col style={{display: "flex",alignItems: "end", justifyContent: "center"}}>
                        <div className="loading-cube1"></div>
                        <div className="loading-cube2"></div>
                        <div className="loading-cube3"></div>
                        <div className="shadow"></div>
                    </Col>
                    <Col>
                        <h1>Sorry we are currently under maintenance...</h1>
                    </Col>
                </Row>
            </Container>
        </>
    )
}
export default maintenance;






